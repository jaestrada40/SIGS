import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { Entidad, Roles } from './auth';
import { Rol } from './enums';
import { Usuario } from '../usuarios/usuario.entity';

// Registro de actividad por entidad. Guarda QUÉ campos cambiaron, nunca sus valores (datos de salud).
@Entity('bitacora')
@Index(['entidadId', 'id'])
export class Bitacora {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadId: number;
  @Column() tabla: string;
  @Column({ type: 'int', nullable: true }) usuarioId: number | null;   // quién lo hizo
  @Column({ type: 'int', nullable: true }) registroId: number | null;
  @Column() accion: string;
  @Column({ type: 'jsonb', nullable: true }) detalle: Record<string, unknown> | null;
  @CreateDateColumn() creadoEn: Date;
}

export type Quien = { entidadId: number; usuarioId?: number | null };
export const registrar = (repo: Repository<Bitacora>, q: Quien, tabla: string, registroId: number | null, accion: string, detalle: Record<string, unknown> | null = null) =>
  repo.save(repo.create({ entidadId: q.entidadId, usuarioId: q.usuarioId ?? null, tabla, registroId, accion, detalle }));

export class ExportacionDto {
  @IsIn(['paciente', 'estudio', 'campana', 'bitacora']) recurso: string;
  @IsInt() @Min(0) @Max(1_000_000) filas: number;
}

@Roles(Rol.ADMIN, Rol.AUDITOR)
@Controller('bitacora')
export class BitacoraController {
  constructor(@InjectRepository(Bitacora) private repo: Repository<Bitacora>, @InjectRepository(Usuario) private usuarios: Repository<Usuario>) {}
  // Solo lectura, solo de la propia entidad y solo para ADMIN y AUDITOR: no hay endpoints para modificar o borrar la bitácora.
  @Get() async list(@Entidad() { entidadId }) {
    const [filas, us] = await Promise.all([
      this.repo.find({ where: { entidadId }, order: { id: 'DESC' }, take: 500 }),
      this.usuarios.find({ where: { entidadId }, select: { id: true, nombre: true, correo: true, rol: true } }),
    ]);
    const por = new Map(us.map((u) => [u.id, u]));
    return filas.map((f) => ({ ...f, usuario: f.usuarioId ? (por.get(f.usuarioId) ?? null) : null }));
  }

  // Cada descarga de datos queda registrada (quién, qué y cuántas filas; nunca el contenido). Cualquier rol con acceso de lectura puede exportar.
  // Límite conocido: registra lo que el cliente declara; la exportación real desde el servidor (que no dependa del navegador) sería el cierre completo.
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.AUDITOR)
  @Post('exportacion') async exportacion(@Entidad() u, @Body() { recurso, filas }: ExportacionDto) {
    await registrar(this.repo, u, recurso, null, 'EXPORTAR', { filas });
    return { ok: true };
  }
}
