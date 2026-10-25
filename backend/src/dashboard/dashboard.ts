import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entidad } from '../common/auth';
import { TipoEntidad } from '../common/enums';
import { Campana } from '../campanas/campanas';
import { Estudio } from '../estudios/estudios';
import { Paciente } from '../pacientes/pacientes';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectRepository(Paciente) private pacientes: Repository<Paciente>,
    @InjectRepository(Estudio) private estudios: Repository<Estudio>,
    @InjectRepository(Campana) private campanas: Repository<Campana>,
  ) {}

  @Get() async totales(@Entidad() { entidadId, tipo }) {
    const totalPacientes = await this.pacientes.countBy({ entidadId });
    if (tipo === TipoEntidad.CENTRO_DIAGNOSTICO) return { totalPacientes, totalEstudios: await this.estudios.countBy({ entidadId }) };
    const { sum } = await this.campanas.createQueryBuilder('c').select('COALESCE(SUM(c."personasAtendidas"),0)', 'sum').where('c."entidadId" = :entidadId', { entidadId }).getRawOne();
    return { totalPacientes, totalCampanas: await this.campanas.countBy({ entidadId }), totalPersonasAtendidas: Number(sum) };
  }
}
