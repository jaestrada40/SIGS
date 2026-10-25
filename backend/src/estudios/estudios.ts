import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { InjectRepository } from '@nestjs/typeorm';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Column, Entity, In, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { Entidad, SoloTipo, TipoGuard } from '../common/auth';
import { TipoEntidad } from '../common/enums';
import { Bitacora, registrar } from '../common/bitacora';
import { rechazar, validarFilas } from '../common/importar';
import { Paciente } from '../pacientes/pacientes';
import { Referido } from '../referidos/referido.entity';
import { numerico } from '../common/numerico';

@Entity('estudio')
export class Estudio {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadId: number;
  @Column() pacienteId: number;
  @Column() tipoEstudio: string;
  @Column({ nullable: true }) salaEquipo: string;
  @Column({ type: 'date' }) fecha: string;
  @Column({ type: 'time', nullable: true }) hora: string;
  @Column({ nullable: true }) especialista: string;
  @Column({ type: 'text', nullable: true }) resultado: string;
  @Column({ nullable: true }) estado: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numerico }) monto: number | null;   // cobro en quetzales (opcional)
}

export class CreateEstudioDto {
  @IsInt() pacienteId: number;
  @IsString() @IsNotEmpty() tipoEstudio: string;
  @IsDateString() fecha: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/) hora?: string;
  @IsOptional() @IsString() salaEquipo?: string;
  @IsOptional() @IsString() especialista?: string;
  @IsOptional() @IsString() resultado?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) monto?: number;
}
// En el archivo el paciente se identifica por su DPI (el id interno no lo conoce quien trae un Excel).
class ImportEstudioDto extends OmitType(CreateEstudioDto, ['pacienteId'] as const) {
  @IsString() @IsNotEmpty() dpi: string;
}
class UpdateEstudioDto extends PartialType(OmitType(CreateEstudioDto, ['pacienteId'] as const)) {}

@UseGuards(TipoGuard)
@SoloTipo(TipoEntidad.CENTRO_DIAGNOSTICO)
@Controller('estudios')
export class EstudiosController {
  constructor(@InjectRepository(Estudio) private repo: Repository<Estudio>, @InjectRepository(Paciente) private pacientes: Repository<Paciente>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>, @InjectRepository(Referido) private referidos: Repository<Referido>) {}
  @Get() list(@Entidad() { entidadId }) { return this.repo.findBy({ entidadId }); }
  @Post() async create(@Entidad() u, @Body() dto: CreateEstudioDto) {
    // the paciente must belong to the same entidad
    if (!(await this.pacientes.existsBy({ id: dto.pacienteId, entidadId: u.entidadId }))) throw new NotFoundException('paciente');
    const e = await this.repo.save(this.repo.create({ ...dto, entidadId: u.entidadId }));
    await registrar(this.bit, u, 'estudio', e.id, 'CREAR');
    return e;
  }
  @Post('importar') async importar(@Entidad() u, @Body() body: { filas: unknown[] }) {
    const filas = await validarFilas(ImportEstudioDto, body?.filas);
    const pacientes = await this.pacientes.findBy({ entidadId: u.entidadId, dpi: In([...new Set(filas.map((f) => f.dpi))]) });
    const porDpi = new Map(pacientes.map((p) => [p.dpi, p.id]));
    const errores = filas.flatMap((f, i) => (porDpi.has(f.dpi) ? [] : [{ fila: i + 2, mensaje: `No hay un paciente con DPI ${f.dpi} en su entidad` }]));
    if (errores.length) throw rechazar(errores);
    await this.repo.save(filas.map(({ dpi, ...f }) => this.repo.create({ ...f, entidadId: u.entidadId, pacienteId: porDpi.get(dpi) })));
    await registrar(this.bit, u, 'estudio', null, 'IMPORTAR', { filas: filas.length });
    return { importados: filas.length };
  }
  @Get(':id') async one(@Entidad() { entidadId }, @Param('id', ParseIntPipe) id: number) {
    const e = await this.repo.findOneBy({ id, entidadId });
    if (!e) throw new NotFoundException();
    return e;
  }
  @Patch(':id') async update(@Entidad() u, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEstudioDto) {
    const r = await this.repo.save(Object.assign(await this.one(u, id), dto));
    await registrar(this.bit, u, 'estudio', id, 'MODIFICAR', { campos: Object.keys(dto) });
    // Si el estudio venía de un referido agendado y ya se realizó, el referido pasa a «atendido» (el organismo verá el estado, nunca el resultado).
    if (dto.estado === 'REALIZADO') {
      const ref = await this.referidos.findOneBy({ estudioId: id, entidadDestinoId: u.entidadId, estado: 'AGENDADO' });
      if (ref) { await this.referidos.update(ref.id, { estado: 'ATENDIDO', atendidoEn: new Date() }); await registrar(this.bit, u, 'referido', ref.id, 'MODIFICAR', { campos: ['estado'] }); }
    }
    return r;
  }
}
