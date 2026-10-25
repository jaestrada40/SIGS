import { Body, Controller, ForbiddenException, Get, HttpException, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Entidad as Quien, Roles } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { Rol } from '../common/enums';
import { ActualizarUsuarioDto, CrearUsuarioDto, NuevaPasswordDto } from '../auth/auth.dto';
import { Usuario } from './usuario.entity';

type Sesion = { entidadId: number; usuarioId: number };

// Gestión de usuarios de la propia entidad. Solo ADMIN. No hay borrado: se desactiva, para no romper la trazabilidad de la bitácora.
// El administrador que actúa no puede cambiarse a sí mismo (rol, estado, MFA, contraseña): así siempre queda al menos un administrador activo.
@Roles(Rol.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(@InjectRepository(Usuario) private repo: Repository<Usuario>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>) {}

  private async propio(s: Sesion, id: number) {
    const u = await this.repo.findOneBy({ id, entidadId: s.entidadId });   // otra entidad -> 404, no 403: no revela que existe
    if (!u) throw new NotFoundException();
    return u;
  }
  private ajeno(s: Sesion, id: number) {
    if (id === s.usuarioId) throw new ForbiddenException('No puede hacer esto sobre su propia cuenta. Pídaselo a otro administrador.');
  }
  private revocar = (id: number) => this.repo.update(id, { sesionesDesde: new Date() });

  @Get() list(@Quien() { entidadId }) { return this.repo.find({ where: { entidadId }, order: { id: 'ASC' } }); }

  @Post() async crear(@Quien() s: Sesion, @Body() { password, correo, ...dto }: CrearUsuarioDto) {
    if (await this.repo.findOneBy({ correo })) throw new HttpException('Ese correo ya está registrado.', 409);
    const u = await this.repo.save(this.repo.create({ ...dto, correo, entidadId: s.entidadId, passwordHash: await bcrypt.hash(password, 12) }));
    await registrar(this.bit, s, 'usuario', u.id, 'CREAR', { campos: ['rol'], rol: u.rol });
    return this.repo.findOneByOrFail({ id: u.id });
  }

  @Patch(':id') async actualizar(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarUsuarioDto) {
    const u = await this.propio(s, id);
    const cambiaRol = dto.rol !== undefined && dto.rol !== u.rol;
    const cambiaActivo = dto.activo !== undefined && dto.activo !== u.activo;
    if (cambiaRol || cambiaActivo) this.ajeno(s, id);
    await this.repo.update(id, { ...(dto.nombre !== undefined && { nombre: dto.nombre }), ...(dto.rol !== undefined && { rol: dto.rol }), ...(dto.activo !== undefined && { activo: !!dto.activo }) });
    if (cambiaRol || cambiaActivo) await this.revocar(id);   // el rol o el acceso cambian ya, no al vencer el token
    if (cambiaActivo) await registrar(this.bit, s, 'usuario', id, dto.activo ? 'ACTIVAR' : 'DESACTIVAR');
    const campos = [dto.nombre !== undefined && 'nombre', cambiaRol && 'rol'].filter(Boolean);
    if (campos.length) await registrar(this.bit, s, 'usuario', id, 'MODIFICAR', { campos, ...(cambiaRol && { rol: dto.rol }) });
    return this.repo.findOneByOrFail({ id });
  }

  // Para quien perdió su teléfono y sus códigos de recuperación: borra el MFA y exige configurarlo de nuevo.
  @Post(':id/restablecer-mfa') async restablecerMfa(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number) {
    await this.propio(s, id); this.ajeno(s, id);
    await this.repo.update(id, { mfaActivo: false, mfaSecreto: null, mfaUltimoPaso: null, mfaRecuperacion: null, sesionesDesde: new Date() });
    await registrar(this.bit, s, 'usuario', id, 'RESTABLECER_MFA');
    return { ok: true };
  }

  @Post(':id/restablecer-password') async restablecerPassword(@Quien() s: Sesion, @Param('id', ParseIntPipe) id: number, @Body() { password }: NuevaPasswordDto) {
    await this.propio(s, id); this.ajeno(s, id);
    await this.repo.update(id, { passwordHash: await bcrypt.hash(password, 12), sesionesDesde: new Date(), intentosFallidos: 0, bloqueadoHasta: null });
    await registrar(this.bit, s, 'usuario', id, 'RESTABLECER_PASSWORD');
    return { ok: true };
  }
}
