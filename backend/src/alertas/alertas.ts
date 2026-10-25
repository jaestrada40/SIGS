import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Entidad } from '../common/auth';
import { TipoEntidad } from '../common/enums';

// Cosas que alguien debería atender hoy. Se calculan al consultar, sin tabla propia: si se corrigen, la alerta desaparece sola.
export type Alerta = { clave: string; nivel: 'alta' | 'media'; cantidad: number; mensaje: string; ruta: string };
const DIAS_REFERIDO_SIN_AGENDAR = 3;
const DIAS_REFERIDO_SIN_ATENDER = 14;

@Controller('alertas')
export class AlertasController {
  constructor(@InjectDataSource() private db: DataSource) {}
  private n = async (sql: string, id: number) => ((await this.db.query(sql, [id])) as { n: number }[])[0]?.n ?? 0;

  @Get() async listar(@Entidad() u: { entidadId: number; tipo: TipoEntidad }): Promise<Alerta[]> {
    const id = u.entidadId;
    const defs: [Alerta['clave'], Alerta['nivel'], string, (n: number) => string, string][] = u.tipo === TipoEntidad.CENTRO_DIAGNOSTICO ? [
      ['estudios_vencidos', 'alta', `SELECT COUNT(*)::int n FROM estudio WHERE "entidadId"=$1 AND estado='PROGRAMADO' AND fecha < CURRENT_DATE`, (n) => `${n} ${n === 1 ? 'estudio programado ya pasó' : 'estudios programados ya pasaron'} de fecha sin realizarse o cancelarse.`, '/estudios'],
      ['sin_resultado', 'media', `SELECT COUNT(*)::int n FROM estudio WHERE "entidadId"=$1 AND estado='REALIZADO' AND COALESCE(btrim(resultado),'')=''`, (n) => `${n} ${n === 1 ? 'estudio realizado no tiene' : 'estudios realizados no tienen'} resultado registrado.`, '/estudios'],
      ['referidos_sin_agendar', 'media', `SELECT COUNT(*)::int n FROM referido WHERE "entidadDestinoId"=$1 AND estado='PENDIENTE' AND "creadoEn" < now() - interval '${DIAS_REFERIDO_SIN_AGENDAR} days'`, (n) => `${n} ${n === 1 ? 'referido lleva' : 'referidos llevan'} más de ${DIAS_REFERIDO_SIN_AGENDAR} días sin agendar.`, '/referidos'],
      ['sin_monto', 'media', `SELECT COUNT(*)::int n FROM estudio WHERE "entidadId"=$1 AND estado='REALIZADO' AND monto IS NULL`, (n) => `${n} ${n === 1 ? 'estudio realizado no tiene' : 'estudios realizados no tienen'} monto: los ingresos quedan incompletos.`, '/estudios'],
    ] : [
      ['referidos_sin_atender', 'alta', `SELECT COUNT(*)::int n FROM referido WHERE "entidadOrigenId"=$1 AND estado IN ('PENDIENTE','AGENDADO') AND "creadoEn" < now() - interval '${DIAS_REFERIDO_SIN_ATENDER} days'`, (n) => `${n} ${n === 1 ? 'persona referida lleva' : 'personas referidas llevan'} más de ${DIAS_REFERIDO_SIN_ATENDER} días sin llegar al estudio.`, '/referidos'],
      ['campanas_vencidas', 'media', `SELECT COUNT(*)::int n FROM campana WHERE "entidadId"=$1 AND estado='EN_CURSO' AND "fechaFin" < CURRENT_DATE`, (n) => `${n} ${n === 1 ? 'campaña sigue' : 'campañas siguen'} «en curso» después de su fecha de fin.`, '/campanas'],
      ['campanas_sin_costo', 'media', `SELECT COUNT(*)::int n FROM campana WHERE "entidadId"=$1 AND costo IS NULL`, (n) => `${n} ${n === 1 ? 'campaña no tiene' : 'campañas no tienen'} costo: el costo por persona queda incompleto.`, '/campanas'],
    ];
    const conteos = await Promise.all(defs.map(([, , sql]) => this.n(sql, id)));
    return defs.flatMap(([clave, nivel, , msg, ruta], i) => (conteos[i]! > 0 ? [{ clave, nivel, cantidad: conteos[i]!, mensaje: msg(conteos[i]!), ruta }] : []));
  }
}
