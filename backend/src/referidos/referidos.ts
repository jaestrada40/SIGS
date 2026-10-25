import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Equals, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DataSource, In, Repository } from 'typeorm';
import { Entidad, SoloTipo, TipoGuard } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { TipoEntidad } from '../common/enums';
import { Entidad as EntidadFila } from '../entidades/entidad.entity';
import { Campana } from '../campanas/campanas';
import { Estudio } from '../estudios/estudios';
import { Paciente } from '../pacientes/pacientes';
import { Referido } from './referido.entity';

export class CrearReferidoDto {
  @IsInt() pacienteId: number;
  @IsOptional() @IsInt() campanaId?: number;
  @IsInt() centroId: number;
  @IsString() @IsNotEmpty() @MaxLength(120) tipoEstudio: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
  @Equals(true, { message: 'Registre el consentimiento de la persona para compartir sus datos con el centro.' }) consentimiento: boolean;
}
export class AgendarReferidoDto {
  @IsDateString() fecha: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/) hora?: string;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin caracteres que se confunden (0/O, 1/I)
const nuevoCodigo = () => { const c = [...randomBytes(8)].map((b) => ALFABETO[b % 32]).join(''); return `${c.slice(0, 4)}-${c.slice(4)}`; };

type Sesion = { entidadId: number; usuarioId: number; tipo: TipoEntidad };

@UseGuards(TipoGuard)
@Controller('referidos')
export class ReferidosController {
  constructor(
    @InjectRepository(Referido) private repo: Repository<Referido>,
    @InjectRepository(EntidadFila) private entidades: Repository<EntidadFila>,
    @InjectRepository(Paciente) private pacientes: Repository<Paciente>,
    @InjectRepository(Campana) private campanas: Repository<Campana>,
    @InjectRepository(Bitacora) private bit: Repository<Bitacora>,
    private db: DataSource,
  ) {}

  // Directorio mínimo de centros (solo id, nombre y departamento) para que un organismo elija a dónde referir.
  @SoloTipo(TipoEntidad.ORG_NO_LUCRATIVA)
  @Get('centros') centros() {
    return this.entidades.find({ where: { tipo: TipoEntidad.CENTRO_DIAGNOSTICO }, select: { id: true, nombre: true, departamento: true }, order: { nombre: 'ASC' } });
  }

  // Cada entidad ve solo lo suyo: el organismo, lo que envió; el centro, lo que recibió.
  @Get() async list(@Entidad() u: Sesion) {
    const esOrg = u.tipo === TipoEntidad.ORG_NO_LUCRATIVA;
    const filas = await this.repo.find({ where: esOrg ? { entidadOrigenId: u.entidadId } : { entidadDestinoId: u.entidadId }, order: { id: 'DESC' }, take: 500 });
    const ids = [...new Set(filas.map((f) => (esOrg ? f.entidadDestinoId : f.entidadOrigenId)))];
    const nombres = new Map((ids.length ? await this.entidades.find({ where: { id: In(ids) }, select: { id: true, nombre: true } }) : []).map((e) => [e.id, e.nombre]));
    return filas.map(({ estudioId, entidadOrigenId, entidadDestinoId, ...f }) => ({
      ...f,
      contraparte: nombres.get(esOrg ? entidadDestinoId : entidadOrigenId) ?? '—',
      ...(esOrg ? {} : { estudioId }),   // el organismo no necesita (ni debe seguir) el estudio del centro
    }));
  }

  @SoloTipo(TipoEntidad.ORG_NO_LUCRATIVA)
  @Post() async crear(@Entidad() u: Sesion, @Body() dto: CrearReferidoDto) {
    const paciente = await this.pacientes.findOneBy({ id: dto.pacienteId, entidadId: u.entidadId });
    if (!paciente) throw new NotFoundException('paciente');
    if (dto.campanaId !== undefined && !(await this.campanas.existsBy({ id: dto.campanaId, entidadId: u.entidadId }))) throw new NotFoundException('campaña');
    if (!(await this.entidades.existsBy({ id: dto.centroId, tipo: TipoEntidad.CENTRO_DIAGNOSTICO }))) throw new NotFoundException('centro');
    let ultimo: unknown;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const r = await this.repo.save(this.repo.create({
          entidadOrigenId: u.entidadId, entidadDestinoId: dto.centroId, campanaId: dto.campanaId ?? null,
          nombreCompleto: paciente.nombreCompleto, sexo: paciente.sexo, dpi: paciente.dpi ?? null, fechaNacimiento: paciente.fechaNacimiento ?? null, telefono: paciente.telefono ?? null,
          tipoEstudio: dto.tipoEstudio, motivo: dto.motivo ?? null, codigo: nuevoCodigo(), consentimientoEn: new Date(),
        }));
        await registrar(this.bit, u, 'referido', r.id, 'CREAR', { campos: ['consentimiento'] });
        const { estudioId, entidadOrigenId, entidadDestinoId, ...visible } = r;
        void estudioId; void entidadOrigenId; void entidadDestinoId;
        return visible;
      } catch (e) { ultimo = e; }   // choque del código único (improbable): se reintenta con otro
    }
    throw ultimo;
  }

  private async propio(u: Sesion, id: number, comoDestino: boolean) {
    const r = await this.repo.findOneBy(comoDestino ? { id, entidadDestinoId: u.entidadId } : { id, entidadOrigenId: u.entidadId });
    if (!r) throw new NotFoundException();   // de otra entidad: 404, no 403 (no revela que existe)
    return r;
  }

  // El centro agenda: crea (o reutiliza por DPI) a la persona en su propia entidad y programa el estudio.
  @SoloTipo(TipoEntidad.CENTRO_DIAGNOSTICO)
  @Post(':id/agendar') async agendar(@Entidad() u: Sesion, @Param('id', ParseIntPipe) id: number, @Body() dto: AgendarReferidoDto) {
    const r = await this.propio(u, id, true);
    if (r.estado !== 'PENDIENTE') throw new ConflictException('El referido ya no está pendiente.');
    await this.db.transaction(async (m) => {
      let p = r.dpi ? await m.findOneBy(Paciente, { entidadId: u.entidadId, dpi: r.dpi }) : null;
      if (!p) p = await m.save(m.create(Paciente, { entidadId: u.entidadId, nombreCompleto: r.nombreCompleto, sexo: r.sexo, dpi: r.dpi ?? undefined, fechaNacimiento: r.fechaNacimiento ?? undefined, telefono: r.telefono ?? undefined, estado: 'ACTIVO' }));
      const e = await m.save(m.create(Estudio, { entidadId: u.entidadId, pacienteId: p.id, tipoEstudio: r.tipoEstudio, fecha: dto.fecha, ...(dto.hora ? { hora: dto.hora } : {}), estado: 'PROGRAMADO' }));
      await m.update(Referido, r.id, { estado: 'AGENDADO', estudioId: e.id, fechaCita: dto.fecha });
    });
    await registrar(this.bit, u, 'referido', id, 'MODIFICAR', { campos: ['estado'] });
    return { ok: true };
  }

  @SoloTipo(TipoEntidad.CENTRO_DIAGNOSTICO)
  @Post(':id/no-llego') async noLlego(@Entidad() u: Sesion, @Param('id', ParseIntPipe) id: number) {
    const r = await this.propio(u, id, true);
    if (r.estado !== 'PENDIENTE' && r.estado !== 'AGENDADO') throw new ConflictException('El referido ya está cerrado.');
    await this.repo.update(r.id, { estado: 'NO_LLEGO' });
    await registrar(this.bit, u, 'referido', id, 'MODIFICAR', { campos: ['estado'] });
    return { ok: true };
  }

  // El organismo puede retirar un referido solo mientras el centro no lo haya agendado.
  @SoloTipo(TipoEntidad.ORG_NO_LUCRATIVA)
  @Post(':id/cancelar') async cancelar(@Entidad() u: Sesion, @Param('id', ParseIntPipe) id: number) {
    const r = await this.propio(u, id, false);
    if (r.estado !== 'PENDIENTE') throw new ConflictException('Solo se puede cancelar un referido pendiente.');
    await this.repo.update(r.id, { estado: 'CANCELADO' });
    await registrar(this.bit, u, 'referido', id, 'MODIFICAR', { campos: ['estado'] });
    return { ok: true };
  }
}
