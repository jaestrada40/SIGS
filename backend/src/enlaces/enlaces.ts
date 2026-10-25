import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Query, Res, UnauthorizedException, UseGuards, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { Entidad, Public, SoloTipo, TipoGuard } from '../common/auth';
import { TipoEntidad } from '../common/enums';
import { Bitacora, registrar } from '../common/bitacora';
import { Estudio } from '../estudios/estudios';
import { Paciente } from '../pacientes/pacientes';
import { Entidad as EntidadEntity } from '../entidades/entidad.entity';

// Enlace para que la persona vea su resultado sin cuenta. Solo se guarda el hash del token (el token se muestra una vez),
// vence, se puede revocar y exige un segundo dato (fecha de nacimiento o últimos 4 del DPI). Tras MAX_INTENTOS fallos se bloquea.
const MAX_INTENTOS = 5;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

@Entity('enlace_resultado')
export class EnlaceResultado {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadId: number;
  @Column() estudioId: number;
  @Index({ unique: true }) @Column() tokenHash: string;
  @Column({ type: 'timestamptz' }) expiraEn: Date;
  @Column({ type: 'timestamptz', nullable: true }) revocadoEn: Date | null;
  @Column({ default: 0 }) intentosFallidos: number;
  @Column({ default: 0 }) accesos: number;
  @Column({ type: 'timestamptz', nullable: true }) ultimoAccesoEn: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}

class CrearEnlaceDto { @IsInt() estudioId: number; @IsOptional() @IsInt() @Min(1) @Max(30) dias?: number; }
class VerDto { @IsString() @Length(20, 200) token: string; @IsString() @Length(4, 10) verificacion: string; }

const iguales = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const soloDigitos = (s: string) => s.replace(/\D/g, '');

@UseGuards(TipoGuard)
@SoloTipo(TipoEntidad.CENTRO_DIAGNOSTICO)
@Controller('enlaces')
export class EnlacesController {
  constructor(@InjectRepository(EnlaceResultado) private repo: Repository<EnlaceResultado>, @InjectRepository(Estudio) private estudios: Repository<Estudio>,
    @InjectRepository(Paciente) private pacientes: Repository<Paciente>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>) {}

  @Post() async crear(@Entidad() u, @Body() dto: CrearEnlaceDto) {
    const e = await this.estudios.findOneBy({ id: dto.estudioId, entidadId: u.entidadId });
    if (!e) throw new NotFoundException('estudio');
    if (e.estado !== 'REALIZADO' || !e.resultado?.trim()) throw new ConflictException('El estudio debe estar realizado y tener resultado.');
    const p = await this.pacientes.findOneBy({ id: e.pacienteId, entidadId: u.entidadId });
    if (!p?.fechaNacimiento && !p?.dpi) throw new ConflictException('La persona no tiene fecha de nacimiento ni DPI: no hay forma de verificar su identidad.');
    const token = randomBytes(24).toString('base64url');
    const dias = dto.dias ?? 7;
    const l = await this.repo.save(this.repo.create({ entidadId: u.entidadId, estudioId: e.id, tokenHash: sha(token), expiraEn: new Date(Date.now() + dias * 86_400_000) }));
    await registrar(this.bit, u, 'enlace', l.id, 'CREAR', { campos: ['estudioId', 'dias'] });
    return { id: l.id, token, expiraEn: l.expiraEn };
  }

  @Get() async listar(@Entidad() { entidadId }, @Query('estudioId', ParseIntPipe) estudioId: number) {
    const filas = await this.repo.find({ where: { entidadId, estudioId }, order: { id: 'DESC' } });
    return filas.map(({ id, expiraEn, revocadoEn, accesos, intentosFallidos, ultimoAccesoEn, creadoEn }) => ({ id, expiraEn, revocadoEn, accesos, intentosFallidos, ultimoAccesoEn, creadoEn }));
  }

  @Post(':id/revocar') async revocar(@Entidad() u, @Param('id', ParseIntPipe) id: number) {
    const l = await this.repo.findOneBy({ id, entidadId: u.entidadId });
    if (!l) throw new NotFoundException();
    if (!l.revocadoEn) { await this.repo.update(id, { revocadoEn: new Date() }); await registrar(this.bit, u, 'enlace', id, 'MODIFICAR', { campos: ['revocadoEn'] }); }
    return { ok: true };
  }
}

@Public()
@Controller('publico')
export class PublicoController {
  constructor(@InjectRepository(EnlaceResultado) private repo: Repository<EnlaceResultado>, @InjectRepository(Estudio) private estudios: Repository<Estudio>,
    @InjectRepository(Paciente) private pacientes: Repository<Paciente>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>,
    @InjectRepository(EntidadEntity) private entidades: Repository<EntidadEntity>) {}

  @Post('resultado') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async ver(@Body() dto: VerDto, @Res({ passthrough: true }) res) {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    const invalido = () => new NotFoundException('Este enlace no es válido o ya venció.');   // mismo mensaje: no revela si existió
    const l = await this.repo.findOneBy({ tokenHash: sha(dto.token) });
    if (!l || l.revocadoEn || l.expiraEn.getTime() < Date.now()) throw invalido();
    // Se reserva el intento ANTES de verificar y en una sola sentencia: peticiones paralelas no pueden adivinar más de MAX_INTENTOS veces.
    const [reservado] = (await this.repo.query(`UPDATE enlace_resultado SET "intentosFallidos" = "intentosFallidos" + 1 WHERE id = $1 AND "intentosFallidos" < $2 AND "revocadoEn" IS NULL RETURNING "intentosFallidos"`, [l.id, MAX_INTENTOS]))[0] ?? [];
    if (!reservado) throw invalido();
    const e = await this.estudios.findOneBy({ id: l.estudioId, entidadId: l.entidadId });
    const p = e && await this.pacientes.findOneBy({ id: e.pacienteId, entidadId: l.entidadId });
    if (!e || !p || e.estado !== 'REALIZADO') throw invalido();
    const dato = dto.verificacion.trim();
    const nac = p.fechaNacimiento ? String(p.fechaNacimiento).slice(0, 10) : null;
    // Los últimos 4 del DPI (10 000 combinaciones) solo sirven si no hay fecha de nacimiento, como dice la pantalla.
    const ultimos4 = !nac && p.dpi ? soloDigitos(p.dpi).slice(-4) : null;
    const ok = (nac !== null && iguales(dato, nac)) || (ultimos4 !== null && /^\d{4}$/.test(dato) && iguales(dato, ultimos4));
    if (!ok) {
      const n = reservado.intentosFallidos as number;
      await registrar(this.bit, { entidadId: l.entidadId }, 'enlace', l.id, 'ACCESO_FALLIDO', { intento: n });
      throw new UnauthorizedException(n >= MAX_INTENTOS ? 'Demasiados intentos. Pida un enlace nuevo al centro.' : 'Los datos no coinciden.');
    }
    await this.repo.query(`UPDATE enlace_resultado SET accesos = accesos + 1, "ultimoAccesoEn" = now(), "intentosFallidos" = 0 WHERE id = $1`, [l.id]);
    await registrar(this.bit, { entidadId: l.entidadId }, 'enlace', l.id, 'ACCESO');
    const centro = await this.entidades.findOneBy({ id: l.entidadId });
    return { centro: centro?.nombre ?? '', paciente: p.nombreCompleto, tipoEstudio: e.tipoEstudio, fecha: e.fecha, resultado: e.resultado, expiraEn: l.expiraEn };
  }
}
