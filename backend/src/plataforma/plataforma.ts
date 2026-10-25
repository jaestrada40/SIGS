import { Body, ConflictException, Controller, ForbiddenException, Get, Injectable, NotFoundException, OnModuleInit, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Not, Repository } from 'typeorm';
import { CrearEntidadDto } from '../auth/auth.dto';
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

type Sesion = { entidadId: number; usuarioId: number };

// Alta de entidades: solo el superadmin. Nunca ve pacientes ni estudios, solo quién existe y si ya activó su acceso.
@Roles(Rol.SUPERADMIN)
@Controller('plataforma')
export class PlataformaController {
  constructor(
    @InjectRepository(Entidad) private entidades: Repository<Entidad>,
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(Bitacora) private bit: Repository<Bitacora>,
  ) {}

  // Segunda barrera además del rol: el superadmin solo actúa desde la entidad de plataforma.
  private async soloPlataforma({ entidadId }: Sesion) {
    if (!(await this.entidades.existsBy({ id: entidadId, tipo: TipoEntidad.PLATAFORMA }))) throw new ForbiddenException();
  }

  private nuevaInvitacion() {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: sha256(token), vence: new Date(Date.now() + VIGENCIA_MS) };
  }

  @Get('entidades') async listar(@Quien() s: Sesion) {
    await this.soloPlataforma(s);
    const [entidades, admins] = await Promise.all([
      this.entidades.find({ where: { tipo: Not(TipoEntidad.PLATAFORMA) }, order: { id: 'DESC' } }),
      this.usuarios.find({ where: { rol: Rol.ADMIN }, order: { id: 'ASC' }, select: { id: true, entidadId: true, correo: true, mfaActivo: true, ultimoAcceso: true, invitacionVence: true } }),
    ]);
    return entidades.map((e) => {
      const a = admins.find((x) => x.entidadId === e.id);
      const estado = !a ? 'sin_administrador' : a.invitacionVence ? (a.invitacionVence < new Date() ? 'invitacion_vencida' : 'invitada') : 'activa';
      return { ...e, estado, ultimoAcceso: a?.ultimoAcceso ?? null };
    });
  }

  @Post('entidades') async crear(@Quien() s: Sesion, @Body() { correo, ...dto }: CrearEntidadDto) {
    await this.soloPlataforma(s);
    if (await this.usuarios.existsBy({ correo }) || await this.entidades.existsBy({ correo })) throw new ConflictException('correo ya registrado');
    const inv = this.nuevaInvitacion();
    const e = await this.entidades.manager.transaction(async (m) => {
      const e = await m.save(m.create(Entidad, { ...dto, correo }));
      // La contraseña inicial es aleatoria e inalcanzable: el administrador crea la suya con el enlace.
      await m.save(m.create(Usuario, { entidadId: e.id, nombre: 'Administrador', correo, rol: Rol.ADMIN, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), COSTO_BCRYPT), invitacionHash: inv.hash, invitacionVence: inv.vence }));
      return e;
    });
    await registrar(this.bit, s, 'entidad', e.id, 'CREAR', { campos: ['entidad', 'administrador'], tipo: e.tipo });
    return { entidad: e, invitacion: inv.token, vence: inv.vence };
  }

  // Un enlace nuevo reemplaza al anterior. Solo mientras el administrador no haya aceptado: después no hay nada que reenviar.
  @Post('entidades/:id/invitacion') async reenviar(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    await this.soloPlataforma(s);
    const a = await this.usuarios.findOne({ where: { entidadId: id, rol: Rol.ADMIN }, order: { id: 'ASC' }, select: { id: true, invitacionVence: true } });
    if (!a) throw new NotFoundException();
    if (!a.invitacionVence) throw new ConflictException('La entidad ya activó su acceso.');
    const inv = this.nuevaInvitacion();
    await this.usuarios.update(a.id, { invitacionHash: inv.hash, invitacionVence: inv.vence });
    await registrar(this.bit, s, 'entidad', id, 'REINVITAR');
    return { invitacion: inv.token, vence: inv.vence };
  }
}
