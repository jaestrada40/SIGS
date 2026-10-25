import { Transform } from 'class-transformer';
import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { InjectRepository } from '@nestjs/typeorm';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DepartamentoValido, MunicipioDelDepartamento, normalizarTelefono, TELEFONO_GT } from '../common/geografia';
import { Column, Entity, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { Entidad } from '../common/auth';
import { Sexo } from '../common/enums';
import { Bitacora, registrar } from '../common/bitacora';
import { validarFilas } from '../common/importar';

@Entity('paciente')
export class Paciente {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadId: number;
  @Column() nombreCompleto: string;
  @Column({ nullable: true }) dpi: string;
  @Column({ type: 'date', nullable: true }) fechaNacimiento: string;
  @Column({ type: 'enum', enum: Sexo }) sexo: Sexo;
  @Column({ nullable: true }) departamento: string;
  @Column({ nullable: true }) municipio: string;
  @Column({ nullable: true }) telefono: string;
  @Column({ nullable: true }) contactoEmergencia: string;
  @Column({ nullable: true }) estado: string;
}

export class CreatePacienteDto {
  @IsString() @IsNotEmpty() nombreCompleto: string;
  @IsEnum(Sexo) sexo: Sexo;
  @IsOptional() @Matches(/^\d{13}$/, { message: 'El DPI debe tener exactamente 13 dígitos.' }) dpi?: string;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @DepartamentoValido() departamento?: string;
  @IsOptional() @MunicipioDelDepartamento() municipio?: string;
  @IsOptional() @Transform(({ value }) => normalizarTelefono(value)) @Matches(TELEFONO_GT, { message: 'El teléfono debe tener 8 dígitos (ej. 5512 3456).' }) telefono?: string;
  @IsOptional() @IsString() @MaxLength(200) contactoEmergencia?: string;   // texto libre: nombre y teléfono
  @IsOptional() @IsString() estado?: string;
}
class UpdatePacienteDto extends PartialType(CreatePacienteDto) {}

@Controller('pacientes')
export class PacientesController {
  constructor(@InjectRepository(Paciente) private repo: Repository<Paciente>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>) {}
  @Get() list(@Entidad() { entidadId }) { return this.repo.findBy({ entidadId }); }
  @Post() async create(@Entidad() u, @Body() dto: CreatePacienteDto) {
    const p = await this.repo.save(this.repo.create({ ...dto, entidadId: u.entidadId }));
    await registrar(this.bit, u, 'paciente', p.id, 'CREAR');
    return p;
  }
  // Carga masiva: todo o nada. Los pacientes del archivo quedan en la entidad de quien importa.
  @Post('importar') async importar(@Entidad() u, @Body() body: { filas: unknown[] }) {
    const filas = await validarFilas(CreatePacienteDto, body?.filas);
    await this.repo.save(filas.map((f) => this.repo.create({ ...f, entidadId: u.entidadId })));
    await registrar(this.bit, u, 'paciente', null, 'IMPORTAR', { filas: filas.length });
    return { importados: filas.length };
  }
  @Get(':id') async one(@Entidad() { entidadId }, @Param('id', ParseIntPipe) id: number) {
    const p = await this.repo.findOneBy({ id, entidadId });
    if (!p) throw new NotFoundException();
    return p;
  }
  @Patch(':id') async update(@Entidad() u, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePacienteDto) {
    const p = await this.one(u, id);
    const r = await this.repo.save(Object.assign(p, dto));
    await registrar(this.bit, u, 'paciente', id, 'MODIFICAR', { campos: Object.keys(dto) });
    return r;
  }
}
