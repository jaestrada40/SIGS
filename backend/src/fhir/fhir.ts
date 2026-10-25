import { applyDecorators, Controller, Get, Header, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entidad, Roles, SoloTipo, TipoGuard } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { Rol, TipoEntidad } from '../common/enums';
import { Entidad as EntidadEntity } from '../entidades/entidad.entity';
import { Estudio } from '../estudios/estudios';
import { Paciente } from '../pacientes/pacientes';

// Exportación FHIR R4 de un SUBCONJUNTO: Patient, DiagnosticReport (solo texto, sin codificación LOINC/SNOMED) y Organization.
// No es un servidor FHIR (sin búsqueda ni escritura): entrega un Bundle para intercambio. Se llama «FHIR (subconjunto)», no «compatible».
// El identificador del DPI usa un sistema provisional (urn:gt:renap:cui) hasta que exista uno oficial.
// Son datos personales completos: solo administrador y auditor, y cada descarga queda en la auditoría.
// @Header solo vale por método: este decorador agrupa los dos que necesita toda respuesta FHIR con datos personales.
const Fhir = (ruta: string) => applyDecorators(Get(ruta), Header('Content-Type', 'application/fhir+json; charset=utf-8'), Header('Cache-Control', 'no-store'));
const SEXO = { F: 'female', M: 'male', NE: 'unknown' } as const;
const bundle = (resources: object[]) => ({ resourceType: 'Bundle', type: 'collection', total: resources.length, entry: resources.map((resource: any) => ({ fullUrl: `${resource.resourceType}/${resource.id}`, resource })) });
const sinVacios = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))) as T;

@UseGuards(TipoGuard)
@Roles(Rol.ADMIN, Rol.AUDITOR)
@Controller('fhir')
export class FhirController {
  constructor(@InjectRepository(Paciente) private pacientes: Repository<Paciente>, @InjectRepository(Estudio) private estudios: Repository<Estudio>,
    @InjectRepository(EntidadEntity) private entidades: Repository<EntidadEntity>, @InjectRepository(Bitacora) private bit: Repository<Bitacora>) {}

  private audita = (u, recurso: string, filas: number) => registrar(this.bit, u, 'fhir', null, 'EXPORTAR', { recurso, filas });

  @Fhir('Patient') async patient(@Entidad() u) {
    const filas = await this.pacientes.find({ where: { entidadId: u.entidadId }, order: { id: 'ASC' } });
    await this.audita(u, 'Patient', filas.length);
    return bundle(filas.map((p) => sinVacios({
      resourceType: 'Patient', id: String(p.id),
      identifier: p.dpi ? [{ system: 'urn:gt:renap:cui', value: p.dpi }] : [],
      name: [{ text: p.nombreCompleto }],   // sin separar apellidos: el nombre se guarda como un solo texto
      gender: SEXO[p.sexo] ?? 'unknown',
      birthDate: p.fechaNacimiento ? String(p.fechaNacimiento).slice(0, 10) : undefined,
      telecom: p.telefono ? [{ system: 'phone', value: p.telefono }] : [],
      address: p.departamento || p.municipio ? [{ country: 'GT', state: p.departamento ?? undefined, city: p.municipio ?? undefined }] : [],
      managingOrganization: { reference: `Organization/${u.entidadId}` },
    })));
  }

  @SoloTipo(TipoEntidad.CENTRO_DIAGNOSTICO)
  @Fhir('DiagnosticReport') async diagnosticReport(@Entidad() u) {
    const filas = await this.estudios.find({ where: { entidadId: u.entidadId, estado: 'REALIZADO' }, order: { id: 'ASC' } });
    await this.audita(u, 'DiagnosticReport', filas.length);
    return bundle(filas.map((e) => sinVacios({
      resourceType: 'DiagnosticReport', id: String(e.id), status: 'final',
      code: { text: e.tipoEstudio },
      subject: { reference: `Patient/${e.pacienteId}` },
      effectiveDateTime: e.hora ? `${e.fecha}T${e.hora.slice(0, 5)}` : e.fecha,
      performer: [{ reference: `Organization/${u.entidadId}` }],
      conclusion: e.resultado?.trim() || undefined,
    })));
  }

  @Fhir('Organization') async organization(@Entidad() u) {
    const e = await this.entidades.findOneByOrFail({ id: u.entidadId });
    await this.audita(u, 'Organization', 1);
    return bundle([{ resourceType: 'Organization', id: String(e.id), name: e.nombre, type: [{ text: u.tipo === TipoEntidad.CENTRO_DIAGNOSTICO ? 'Centro de diagnóstico' : 'Organismo no lucrativo' }] }]);
  }
}
