import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Entidad, Roles } from '../common/auth';
import { Rol, TipoEntidad } from '../common/enums';

// Indicadores de impacto (organismos) y de negocio (centros), calculados con SQL sobre la base de la aplicación.
// Son las mismas preguntas del modelo estrella del almacén de datos, pero en vivo y sin desplegar un segundo motor.
// Los montos son opcionales: cada indicador dice con cuántos registros se calculó, para no presentar como cifra completa una que no lo es.
// Solo administrador y auditor: los ingresos de un centro no son para todo el personal.
type Sesion = { entidadId: number; tipo: TipoEntidad };
const MESES_ATRAS = 5;   // el mes actual y los cinco anteriores

@Roles(Rol.ADMIN, Rol.AUDITOR)
@Controller('impacto')
export class ImpactoController {
  constructor(@InjectDataSource() private db: DataSource) {}
  // El SQL usa ? (MySQL); cada ? lleva el id de la entidad.
  private q = <T = Record<string, unknown>>(sql: string, id: number) => this.db.query(sql, Array(sql.split('?').length - 1).fill(id)) as Promise<T[]>;
  private serie = `WITH RECURSIVE meses AS (SELECT DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ${MESES_ATRAS} MONTH) AS m UNION ALL SELECT DATE_ADD(m, INTERVAL 1 MONTH) FROM meses WHERE m < DATE_FORMAT(CURDATE(), '%Y-%m-01'))`;

  private async demografia(id: number) {
    const [sexo, edades, deptos, total] = await Promise.all([
      this.q<{ sexo: string; total: number }>(`SELECT sexo AS sexo, COUNT(*) AS total FROM paciente WHERE entidadId = ? GROUP BY sexo ORDER BY total DESC`, id),
      this.q<{ rango: string; total: number }>(
        `SELECT CASE WHEN fechaNacimiento IS NULL THEN 'Sin dato'
                     WHEN TIMESTAMPDIFF(YEAR, fechaNacimiento, CURDATE()) < 18 THEN '0 a 17'
                     WHEN TIMESTAMPDIFF(YEAR, fechaNacimiento, CURDATE()) < 40 THEN '18 a 39'
                     WHEN TIMESTAMPDIFF(YEAR, fechaNacimiento, CURDATE()) < 60 THEN '40 a 59' ELSE '60 o más' END AS rango, COUNT(*) AS total
         FROM paciente WHERE entidadId = ? GROUP BY 1`, id),
      this.q<{ departamento: string; total: number }>(`SELECT COALESCE(departamento, 'Sin dato') AS departamento, COUNT(*) AS total FROM paciente WHERE entidadId = ? GROUP BY 1 ORDER BY total DESC LIMIT 10`, id),
      this.q<{ n: number }>(`SELECT COUNT(*) AS n FROM paciente WHERE entidadId = ?`, id),
    ]);
    const orden = ['0 a 17', '18 a 39', '40 a 59', '60 o más', 'Sin dato'];
    return { pacientes: total[0]?.n ?? 0, sexo, edades: edades.sort((a, b) => orden.indexOf(a.rango) - orden.indexOf(b.rango)), departamentos: deptos };
  }

  private async referidos(id: number, comoOrigen: boolean) {
    const filas = await this.q<{ estado: string; n: number }>(`SELECT estado, COUNT(*) AS n FROM referido WHERE ${comoOrigen ? 'entidadOrigenId' : 'entidadDestinoId'} = ? GROUP BY estado`, id);
    const por = (e: string) => filas.find((f) => f.estado === e)?.n ?? 0;
    const total = filas.reduce((s, f) => s + f.n, 0), atendidos = por('ATENDIDO'), cerrados = atendidos + por('NO_LLEGO');
    return { total, pendientes: por('PENDIENTE') + por('AGENDADO'), atendidos, noLlegaron: por('NO_LLEGO'), tasaAtencion: cerrados ? Math.round((100 * atendidos) / cerrados) : null };
  }

  @Get() async indicadores(@Entidad() u: Sesion) {
    const id = u.entidadId;
    const base = { generadoEn: new Date().toISOString() };
    if (u.tipo === TipoEntidad.CENTRO_DIAGNOSTICO) {
      const [estados, porMes, porTipo, demografia, referidos] = await Promise.all([
        this.q<{ estado: string; n: number; ingresos: number; conMonto: number }>(`SELECT COALESCE(estado, 'SIN_ESTADO') AS estado, COUNT(*) AS n, CAST(COALESCE(SUM(monto), 0) AS DOUBLE) AS ingresos, COUNT(monto) AS conMonto FROM estudio WHERE entidadId = ? GROUP BY 1`, id),
        this.q(`${this.serie} SELECT DATE_FORMAT(meses.m, '%Y-%m') AS mes, COUNT(e.id) AS valor, CAST(COALESCE(SUM(CASE WHEN e.estado = 'REALIZADO' THEN e.monto END), 0) AS DOUBLE) AS ingresos FROM meses LEFT JOIN estudio e ON e.entidadId = ? AND e.fecha >= meses.m AND e.fecha < DATE_ADD(meses.m, INTERVAL 1 MONTH) GROUP BY meses.m ORDER BY meses.m`, id),
        this.q(`SELECT tipoEstudio AS etiqueta, COUNT(*) AS valor, CAST(COALESCE(SUM(CASE WHEN estado = 'REALIZADO' THEN monto END), 0) AS DOUBLE) AS ingresos FROM estudio WHERE entidadId = ? GROUP BY 1 ORDER BY valor DESC LIMIT 8`, id),
        this.demografia(id), this.referidos(id, false),
      ]);
      const de = (e: string) => estados.find((x) => x.estado === e);
      const realizados = de('REALIZADO'), cancelados = de('CANCELADO')?.n ?? 0, programados = de('PROGRAMADO')?.n ?? 0;
      const conMonto = realizados?.conMonto ?? 0, nRealizados = realizados?.n ?? 0, ingresos = realizados?.ingresos ?? 0;
      return {
        ...base, tipo: 'CENTRO',
        resumen: {
          estudios: estados.reduce((s, x) => s + x.n, 0), realizados: nRealizados, programados, cancelados,
          tasaCancelacion: nRealizados + cancelados ? Math.round((100 * cancelados) / (nRealizados + cancelados)) : null,
          ingresos, ticketPromedio: conMonto ? Math.round((100 * ingresos) / conMonto) / 100 : null,
          realizadosConMonto: conMonto, realizadosSinMonto: nRealizados - conMonto,
        },
        porMes, porTipo, referidos, ...demografia,
      };
    }
    const [r, porMes, porArea, porDepto, porCampana, demografia, referidos] = await Promise.all([
      this.q<Record<string, number>>(`SELECT COUNT(*) AS campanas, COUNT(CASE WHEN estado = 'EN_CURSO' THEN 1 END) AS enCurso, CAST(COALESCE(SUM(personasAtendidas), 0) AS SIGNED) AS personas,
         CAST(COALESCE(SUM(costo), 0) AS DOUBLE) AS costo, COUNT(costo) AS conCosto,
         CAST(COALESCE(SUM(CASE WHEN costo IS NOT NULL AND personasAtendidas > 0 THEN costo END), 0) AS DOUBLE) AS costoComparable,
         CAST(COALESCE(SUM(CASE WHEN costo IS NOT NULL AND personasAtendidas > 0 THEN personasAtendidas END), 0) AS SIGNED) AS personasComparable
         FROM campana WHERE entidadId = ?`, id),
      this.q(`${this.serie} SELECT DATE_FORMAT(meses.m, '%Y-%m') AS mes, CAST(COALESCE(SUM(c.personasAtendidas), 0) AS SIGNED) AS valor FROM meses LEFT JOIN campana c ON c.entidadId = ? AND c.fechaInicio >= meses.m AND c.fechaInicio < DATE_ADD(meses.m, INTERVAL 1 MONTH) GROUP BY meses.m ORDER BY meses.m`, id),
      this.q(`SELECT area AS etiqueta, CAST(COALESCE(SUM(personasAtendidas), 0) AS SIGNED) AS valor, COUNT(*) AS campanas FROM campana WHERE entidadId = ? GROUP BY area ORDER BY valor DESC`, id),
      this.q(`SELECT COALESCE(departamento, 'Sin dato') AS etiqueta, CAST(COALESCE(SUM(personasAtendidas), 0) AS SIGNED) AS valor FROM campana WHERE entidadId = ? GROUP BY 1 ORDER BY valor DESC LIMIT 10`, id),
      this.q(`SELECT c.id, c.nombre AS etiqueta, CAST(c.personasAtendidas AS SIGNED) AS valor, CAST(c.costo AS DOUBLE) AS costo,
         (SELECT COUNT(*) FROM referido r WHERE r.campanaId = c.id AND r.entidadOrigenId = ?) AS referidos,
         (SELECT COUNT(*) FROM referido r WHERE r.campanaId = c.id AND r.entidadOrigenId = ? AND r.estado = 'ATENDIDO') AS atendidos
         FROM campana c WHERE c.entidadId = ? ORDER BY valor DESC, c.id DESC LIMIT 8`, id),
      this.demografia(id), this.referidos(id, true),
    ]);
    const x = r[0] ?? {};
    return {
      ...base, tipo: 'ORG',
      resumen: {
        campanas: x.campanas ?? 0, enCurso: x.enCurso ?? 0, personas: x.personas ?? 0, costo: x.costo ?? 0, campanasConCosto: x.conCosto ?? 0,
        costoPorPersona: x.personasComparable ? Math.round((100 * (x.costoComparable ?? 0)) / x.personasComparable) / 100 : null,   // solo con campañas que tienen costo y personas
      },
      porMes, porArea, porDepartamento: porDepto, porCampana, referidos, ...demografia,
    };
  }
}
