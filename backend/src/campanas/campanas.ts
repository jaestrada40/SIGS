import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { InjectRepository } from '@nestjs/typeorm';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { Entidad, SoloTipo, TipoGuard } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { Area, EstadoCampana, TipoEntidad } from '../common/enums';

@Entity('campana')
export class Campana {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadId: number;
  @Column() nombre: string;
  @Column({ type: 'enum', enum: Area }) area: Area;
  @Column({ nullable: true }) departamento: string;
  @Column({ nullable: true }) ubicacion: string;
  @Column({ type: 'date' }) fechaInicio: string;
  @Column({ type: 'date', nullable: true }) fechaFin: string;
  @Column({ default: 0 }) personasAtendidas: number;
  @Column({ type: 'enum', enum: EstadoCampana, default: EstadoCampana.PROGRAMADA }) estado: EstadoCampana;
}

export class CreateCampanaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsEnum(Area) area: Area;
  @IsDateString() fechaInicio: string;
  @IsOptional() @IsDateString() fechaFin?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() ubicacion?: string;
  @IsOptional() @IsInt() @Min(0) personasAtendidas?: number;
  @IsOptional() @IsEnum(EstadoCampana) estado?: EstadoCampana;
}
class UpdateCampanaDto extends PartialType(CreateCampanaDto) {}

@UseGuards(TipoGuard)
@SoloTipo(TipoEntidad.ORG_NO_LUCRATIVA)
@Controller('campanas')
export class CampanasController {
  constructor(@InjectRepository(Campana) private repo: Repository<Campana>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>) {}
  @Get() list(@Entidad() { entidadId }) { return this.repo.findBy({ entidadId }); }
  @Post() async create(@Entidad() u, @Body() dto: CreateCampanaDto) {
    const c = await this.repo.save(this.repo.create({ ...dto, entidadId: u.entidadId }));
    await registrar(this.bit, u, 'campana', c.id, 'CREAR');
    return c;
  }
  @Get(':id') async one(@Entidad() { entidadId }, @Param('id', ParseIntPipe) id: number) {
    const c = await this.repo.findOneBy({ id, entidadId });
    if (!c) throw new NotFoundException();
    return c;
  }
  @Patch(':id') async update(@Entidad() u, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampanaDto) {
    const r = await this.repo.save(Object.assign(await this.one(u, id), dto));
    await registrar(this.bit, u, 'campana', id, 'MODIFICAR', { campos: Object.keys(dto) });
    return r;
  }
}
