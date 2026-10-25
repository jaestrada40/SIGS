import { Body, CanActivate, ConflictException, Controller, ExecutionContext, ForbiddenException, Get, Injectable, NotFoundException, OnModuleInit, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MoreThan, Not, Repository } from 'typeorm';
import { ActivoDto, ActualizarEntidadDto, CrearEntidadDto, CrearSuperadminDto, EstadoEntidadDto } from '../auth/auth.dto';
import { Entidad as Quien, Roles } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { sha256 } from '../common/cripto';
import { Rol, TipoEntidad } from '../common/enums';
import { Entidad } from '../entidades/entidad.entity';
import { Usuario } from '../usuarios/usuario.entity';

const VIGENCIA_MS = 72 * 3_600_000;
const COSTO_BCRYPT = 12;

// Crea el superadmin la primera vez que arranca con SUPERADMIN_CORREO y SUPERADMIN_PASSWORD definidos; después las variables ya no hacen falta.
@Injectable()
export class SuperadminInicial implements OnModuleInit {
  constructor(private cfg: ConfigService, @InjectRepository(Entidad) private entidades: Repository<Entidad>, @InjectRepository(Usuario) private usuarios: Repository<Usuario>) {}
  async onModuleInit() {
    const correo = this.cfg.get<string>('SUPERADMIN_CORREO'), password = this.cfg.get<string>('SUPERADMIN_PASSWORD');
    if (!correo || !password || await this.usuarios.existsBy({ rol: Rol.SUPERADMIN })) return;
    if (password.length < 10) throw new Error('SUPERADMIN_PASSWORD debe tener al menos 10 caracteres');
    const e = await this.entidades.save(this.entidades.create({ nombre: 'SISG Plataforma', tipo: TipoEntidad.PLATAFORMA, correo }));
    await this.usuarios.save(this.usuarios.create({ entidadId: e.id, nombre: 'Superadministrador', correo, rol: Rol.SUPERADMIN, passwordHash: await bcrypt.hash(password, COSTO_BCRYPT) }));
  }
}

// Segunda barrera además del rol: el superadmin solo actúa desde la entidad de plataforma.
@Injectable()
export class SoloPlataforma implements CanActivate {
  constructor(@InjectRepository(Entidad) private entidades: Repository<Entidad>) {}
  async canActivate(ctx: ExecutionContext) {
    const u = ctx.switchToHttp().getRequest().user;
    if (!u || !(await this.entidades.existsBy({ id: u.entidadId, tipo: TipoEntidad.PLATAFORMA }))) throw new ForbiddenException();
    return true;
  }
}

type Sesion = { entidadId: number; usuarioId: number };
const DIA_MS = 86_400_000;

// Consola de la plataforma: quién existe, quién puede entrar y qué ha pasado con las cuentas.
// Nunca toca datos de pacientes, estudios ni campañas: solo cuentas, entidades y eventos de seguridad.
@Roles(Rol.SUPERADMIN)
@UseGuards(SoloPlataforma)
@Controller('plataforma')
export class PlataformaController {
  constructor(
    @InjectRepository(Entidad) private entidades: Repository<Entidad>,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Bitacora) private bit: Repository<Bitacora>,
  ) {}

  private nuevaInvitacion() {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: sha256(token), vence: new Date(Date.now() + VIGENCIA_MS) };
  }
  private inaccesible = () => bcrypt.hash(randomBytes(32).toString('hex'), COSTO_BCRYPT);

  // Queda en la bitácora de la plataforma y, si la acción es sobre una entidad ajena, también en la de esa entidad (sin nombre: "la plataforma"), para que pueda ver qué se hizo con sus cuentas.
  private async auditar(s: Sesion, entidadId: number, tabla: string, registroId: number, accion: string, detalle: Record<string, unknown> | null = null) {
    await registrar(this.bit, s, tabla, registroId, accion, detalle);
    if (entidadId !== s.entidadId) await registrar(this.bit, { entidadId }, tabla, registroId, accion, { ...detalle, plataforma: true });
  }
  private async ajena(id: number) {
    const e = await this.entidades.findOneBy({ id, tipo: Not(TipoEntidad.PLATAFORMA) });
    if (!e) throw new NotFoundException();
    return e;
  }
  private async usuario(id: number) {
    const u = await this.usuarios.findOne({ where: { id }, select: { id: true, entidadId: true, rol: true, activo: true, invitacionVence: true } });
    if (!u) throw new NotFoundException();
    return u;
  }
  private noYo(s: Sesion, id: number) {
    if (id === s.usuarioId) throw new ForbiddenException('No puede hacer esto sobre su propia cuenta. Pídaselo a otro superadministrador.');
  }
  private estadoInvitacion = (vence: Date | null) => (!vence ? null : vence < new Date() ? 'vencida' : 'pendiente');

  private async listarEntidades() {
    const [entidades, usuarios] = await Promise.all([
      this.entidades.find({ where: { tipo: Not(TipoEntidad.PLATAFORMA) }, order: { id: 'DESC' } }),
      this.usuarios.find({ order: { id: 'ASC' }, select: { id: true, entidadId: true, rol: true, activo: true, ultimoAcceso: true, invitacionVence: true } }),
    ]);
    return entidades.map((e) => {
      const us = usuarios.filter((u) => u.entidadId === e.id);
      const a = us.find((u) => u.rol === Rol.ADMIN);
      const inv = this.estadoInvitacion(a?.invitacionVence ?? null);
      const estado = !e.activa ? 'suspendida' : !a ? 'sin_administrador' : inv === 'vencida' ? 'invitacion_vencida' : inv === 'pendiente' ? 'invitada' : 'activa';
      const ultimoAcceso = us.map((u) => u.ultimoAcceso).filter(Boolean).sort((x, y) => +y! - +x!)[0] ?? null;
      return { ...e, estado, usuarios: us.length, usuariosActivos: us.filter((u) => u.activo).length, ultimoAcceso };
    });
  }

  @Get('resumen') async resumen() {
    const [entidades, usuarios] = await Promise.all([this.listarEntidades(), this.usuarios.find({ select: { id: true, rol: true, activo: true, mfaActivo: true, invitacionVence: true } })]);
    const desde = new Date(Date.now() - 7 * DIA_MS);
    const finales = usuarios.filter((u) => u.rol !== Rol.SUPERADMIN);
    return {
      entidades: {
        total: entidades.length,
        centros: entidades.filter((e) => e.tipo === TipoEntidad.CENTRO_DIAGNOSTICO).length,
        organismos: entidades.filter((e) => e.tipo === TipoEntidad.ORG_NO_LUCRATIVA).length,
        activas: entidades.filter((e) => e.estado === 'activa').length,
        pendientes: entidades.filter((e) => e.estado === 'invitada' || e.estado === 'invitacion_vencida').length,
        suspendidas: entidades.filter((e) => e.estado === 'suspendida').length,
      },
      usuarios: {
        total: finales.length,
        activos: finales.filter((u) => u.activo).length,
        sinMfa: finales.filter((u) => u.activo && !u.mfaActivo && !u.invitacionVence).length,
        superadmins: usuarios.filter((u) => u.rol === Rol.SUPERADMIN && u.activo).length,
      },
      seguridad: {
        bloqueos7d: await this.bit.countBy({ accion: 'BLOQUEO', creadoEn: MoreThan(desde) }),
        exportaciones7d: await this.bit.countBy({ accion: 'EXPORTAR', creadoEn: MoreThan(desde) }),
      },
    };
  }

  @Get('entidades') listar() { return this.listarEntidades(); }

  @Post('entidades') async crear(@Quien() s: Sesion, @Body() { correo, ...dto }: CrearEntidadDto) {
    if (await this.usuarios.existsBy({ correo }) || await this.entidades.existsBy({ correo })) throw new ConflictException('correo ya registrado');
    const inv = this.nuevaInvitacion();
    const e = await this.entidades.manager.transaction(async (m) => {
      const e = await m.save(m.create(Entidad, { ...dto, correo }));
      // La contraseña inicial es aleatoria e inalcanzable: el administrador crea la suya con el enlace.
      await m.save(m.create(Usuario, { entidadId: e.id, nombre: 'Administrador', correo, rol: Rol.ADMIN, passwordHash: await this.inaccesible(), invitacionHash: inv.hash, invitacionVence: inv.vence }));
      return e;
    });
    await this.auditar(s, e.id, 'entidad', e.id, 'CREAR', { campos: ['entidad', 'administrador'], tipo: e.tipo });
    return { entidad: e, invitacion: inv.token, vence: inv.vence };
  }

  @Patch('entidades/:id') async editar(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarEntidadDto) {
    await this.ajena(id);
    const campos = (Object.keys(dto) as (keyof ActualizarEntidadDto)[]).filter((k) => dto[k] !== undefined);
    if (campos.length) { await this.entidades.update(id, dto); await this.auditar(s, id, 'entidad', id, 'MODIFICAR', { campos }); }
    return this.entidades.findOneByOrFail({ id });
  }

  // Suspender corta el acceso de toda la entidad al instante (se revocan las sesiones abiertas); no borra nada.
  @Patch('entidades/:id/estado') async estado(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() { activa }: EstadoEntidadDto) {
    const e = await this.ajena(id);
    if (e.activa !== activa) {
      await this.entidades.update(id, { activa });
      await this.usuarios.update({ entidadId: id }, { sesionesDesde: new Date() });
      await this.auditar(s, id, 'entidad', id, activa ? 'REACTIVAR' : 'SUSPENDER');
    }
    return this.entidades.findOneByOrFail({ id });
  }

  // Un enlace nuevo reemplaza al anterior. Solo mientras el administrador no haya aceptado: después se usa «restablecer acceso» del usuario.
  @Post('entidades/:id/invitacion') async reenviar(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    const a = await this.usuarios.findOne({ where: { entidadId: id, rol: Rol.ADMIN }, order: { id: 'ASC' }, select: { id: true, invitacionVence: true } });
    if (!a) throw new NotFoundException();
    if (!a.invitacionVence) throw new ConflictException('La entidad ya activó su acceso.');
    const inv = this.nuevaInvitacion();
    await this.usuarios.update(a.id, { invitacionHash: inv.hash, invitacionVence: inv.vence });
    await this.auditar(s, id, 'entidad', id, 'REINVITAR');
    return { invitacion: inv.token, vence: inv.vence };
  }

  @Get('usuarios') async listarUsuarios() {
    const [us, ents] = await Promise.all([
      this.usuarios.find({ order: { id: 'ASC' }, select: { id: true, entidadId: true, nombre: true, correo: true, rol: true, activo: true, mfaActivo: true, creadoEn: true, ultimoAcceso: true, invitacionVence: true } }),
      this.entidades.find(),
    ]);
    const por = new Map(ents.map((e) => [e.id, e]));
    return us.map(({ invitacionVence, ...u }) => ({ ...u, invitacion: this.estadoInvitacion(invitacionVence), entidad: por.get(u.entidadId)?.nombre ?? null, entidadTipo: por.get(u.entidadId)?.tipo ?? null, entidadActiva: por.get(u.entidadId)?.activa ?? false }));
  }

  @Patch('usuarios/:id/activo') async activo(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() { activo }: ActivoDto) {
    this.noYo(s, id);
    const u = await this.usuario(id);
    if (u.activo !== activo) {
      await this.usuarios.update(id, { activo, sesionesDesde: new Date() });
      await this.auditar(s, u.entidadId, 'usuario', id, activo ? 'ACTIVAR' : 'DESACTIVAR');
    }
    return { ok: true };
  }

  // Para quien perdió contraseña y MFA (o se quedó sin otro administrador): borra ambos, cierra sus sesiones y entrega un enlace para empezar de nuevo.
  @Post('usuarios/:id/restablecer-acceso') async restablecerAcceso(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    this.noYo(s, id);
    const u = await this.usuario(id);
    if (!u.activo) throw new ConflictException('Active al usuario antes de restablecer su acceso.');
    const inv = this.nuevaInvitacion();
    await this.usuarios.update(id, {
      passwordHash: await this.inaccesible(), mfaActivo: false, mfaSecreto: null, mfaUltimoPaso: null, mfaRecuperacion: null,
      intentosFallidos: 0, bloqueadoHasta: null, sesionesDesde: new Date(), invitacionHash: inv.hash, invitacionVence: inv.vence,
    });
    await this.auditar(s, u.entidadId, 'usuario', id, 'RESTABLECER_ACCESO');
    return { invitacion: inv.token, vence: inv.vence };
  }

  // Más de un superadministrador evita que perder una cuenta deje la plataforma sin nadie que la gestione.
  @Post('superadmins') async crearSuperadmin(@Quien() s: Sesion, @Body() { nombre, correo }: CrearSuperadminDto) {
    if (await this.usuarios.existsBy({ correo })) throw new ConflictException('correo ya registrado');
    const inv = this.nuevaInvitacion();
    const u = await this.usuarios.save(this.usuarios.create({ entidadId: s.entidadId, nombre, correo, rol: Rol.SUPERADMIN, passwordHash: await this.inaccesible(), invitacionHash: inv.hash, invitacionVence: inv.vence }));
    await this.auditar(s, s.entidadId, 'usuario', u.id, 'CREAR', { campos: ['superadmin'], rol: Rol.SUPERADMIN });
    return { id: u.id, invitacion: inv.token, vence: inv.vence };
  }

  // Solo eventos de cuentas y de seguridad de todas las entidades. Las acciones que la plataforma hizo sobre una entidad ajena se muestran una vez (la copia que ve la entidad se omite).
  @Get('auditoria') async auditoria() {
    const filas = await this.bit.createQueryBuilder('b')
      .where(`(b.tabla IN (:...tablas) OR b.accion IN (:...acciones)) AND (b.detalle->>'plataforma') IS DISTINCT FROM 'true'`, { tablas: ['sesion', 'usuario', 'entidad'], acciones: ['EXPORTAR', 'BLOQUEO', 'ACCESO_FALLIDO'] })
      .orderBy('b.id', 'DESC').take(300).getMany();
    const [us, ents] = await Promise.all([
      this.usuarios.find({ select: { id: true, nombre: true, correo: true, rol: true } }),
      this.entidades.find({ select: { id: true, nombre: true } }),
    ]);
    const u = new Map(us.map((x) => [x.id, x])), e = new Map(ents.map((x) => [x.id, x.nombre]));
    // A quién o a qué se le hizo la acción: en 'entidad' y 'usuario' el registroId es el afectado; en 'sesion' el afectado es quien actúa.
    const objetivo = (f: Bitacora) => f.tabla === 'entidad' ? (e.get(f.registroId ?? -1) ?? null) : f.tabla === 'usuario' && f.registroId ? (u.get(f.registroId) ? `${u.get(f.registroId)!.nombre} (${u.get(f.registroId)!.correo})` : null) : null;
    return filas.map((f) => ({ ...f, usuario: f.usuarioId ? (u.get(f.usuarioId) ?? null) : null, entidad: e.get(f.entidadId) ?? null, objetivo: objetivo(f) }));
  }
}
