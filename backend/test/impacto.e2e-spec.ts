import request from 'supertest';
import { crearApp, crearUsuario, registrar } from './helpers';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const hoy = new Date();
const haceMeses = (n: number) => iso(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 15)));
const mes = (n: number) => haceMeses(n).slice(0, 7);

describe('indicadores de impacto y de negocio', () => {
  let app, centro, org, otro;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await crearApp();
    centro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
    otro = await registrar(app, 'CENTRO_DIAGNOSTICO');
  });
  afterAll(() => app.close());

  async function paciente(a, extra) { return (await http().post('/pacientes').set(a.auth).send({ sexo: 'F', ...extra }).expect(201)).body; }

  it('el monto y el costo son opcionales, numéricos, no negativos y de hasta 2 decimales', async () => {
    const p = await paciente(centro, { nombreCompleto: 'Persona Uno', sexo: 'F', departamento: 'Guatemala', municipio: 'Mixco', fechaNacimiento: '2015-02-01' });
    const ok = (await http().post('/estudios').set(centro.auth).send({ pacienteId: p.id, tipoEstudio: 'Rayos X', fecha: haceMeses(0), estado: 'REALIZADO', monto: 150.5 }).expect(201)).body;
    expect(ok.monto).toBe(150.5);
    expect(typeof (await http().get('/estudios').set(centro.auth)).body[0].monto).toBe('number');   // numeric de Postgres vuelve como número, no como texto
    const mal = (monto) => http().post('/estudios').set(centro.auth).send({ pacienteId: p.id, tipoEstudio: 'X', fecha: haceMeses(0), monto });
    await mal(-1).expect(400); await mal(10.123).expect(400); await mal('mucho').expect(400);
    await http().post('/estudios').set(centro.auth).send({ pacienteId: p.id, tipoEstudio: 'Sin monto', fecha: haceMeses(0) }).expect(201);   // sin monto: válido
    await http().post('/campanas').set(org.auth).send({ nombre: 'C', area: 'CARDIOVASCULAR', fechaInicio: haceMeses(0), costo: -5 }).expect(400);
  });

  it('centro: ingresos, ticket, cancelación, serie de 6 meses, tipos y demografía, con la cobertura de los montos', async () => {
    const c = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const a = await paciente(c, { nombreCompleto: 'Ana', sexo: 'F', departamento: 'Guatemala', municipio: 'Mixco', fechaNacimiento: '1990-01-01' });
    const b = await paciente(c, { nombreCompleto: 'Beto', sexo: 'M', departamento: 'Sacatepéquez', municipio: 'Antigua Guatemala' });   // sin fecha de nacimiento
    const est = (pacienteId, tipoEstudio, fecha, estado, monto?) => http().post('/estudios').set(c.auth).send({ pacienteId, tipoEstudio, fecha, estado, ...(monto !== undefined ? { monto } : {}) }).expect(201);
    await est(a.id, 'Rayos X', haceMeses(0), 'REALIZADO', 150);
    await est(a.id, 'Rayos X', haceMeses(1), 'REALIZADO', 300);
    await est(b.id, 'Ultrasonido', haceMeses(1), 'REALIZADO');           // realizado sin monto
    await est(b.id, 'Ultrasonido', haceMeses(2), 'CANCELADO', 999);      // cancelado: no cuenta como ingreso
    await est(a.id, 'Mamografía', haceMeses(0), 'PROGRAMADO', 500);       // programado: no cuenta como ingreso
    const r = (await http().get('/impacto').set(c.auth).expect(200)).body;
    expect(r.tipo).toBe('CENTRO');
    expect(r.resumen).toMatchObject({ estudios: 5, realizados: 3, programados: 1, cancelados: 1, ingresos: 450, ticketPromedio: 225, realizadosConMonto: 2, realizadosSinMonto: 1, tasaCancelacion: 25 });
    expect(r.porMes).toHaveLength(6);
    expect(r.porMes.at(-1)).toMatchObject({ mes: mes(0), valor: 2, ingresos: 150 });
    expect(r.porMes.at(-2)).toMatchObject({ mes: mes(1), valor: 2, ingresos: 300 });
    expect(r.porMes[0].valor).toBe(0);   // los meses sin movimiento aparecen en cero
    expect(r.porTipo[0]).toMatchObject({ etiqueta: 'Rayos X', valor: 2, ingresos: 450 });
    expect(r.pacientes).toBe(2);
    expect(Object.fromEntries(r.sexo.map((s) => [s.sexo, s.total]))).toEqual({ F: 1, M: 1 });
    expect(r.edades.map((e) => e.rango)).toContain('Sin dato');
    expect(r.departamentos.map((d) => d.departamento).sort()).toEqual(['Guatemala', 'Sacatepéquez']);
  });

  it('centro: aislamiento (otro centro no ve cifras ajenas) y sin datos no inventa promedios', async () => {
    const r = (await http().get('/impacto').set(otro.auth).expect(200)).body;
    expect(r.resumen).toMatchObject({ estudios: 0, ingresos: 0, ticketPromedio: null, tasaCancelacion: null });
    expect(r.pacientes).toBe(0);
  });

  it('organismo: personas, costo por persona (solo con campañas comparables), áreas y referidos por campaña', async () => {
    const o = await registrar(app, 'ORG_NO_LUCRATIVA');
    const c2 = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const camp = (body) => http().post('/campanas').set(o.auth).send({ area: 'CARDIOVASCULAR', fechaInicio: haceMeses(0), ...body }).expect(201);
    const a = (await camp({ nombre: 'Corazón', personasAtendidas: 100, costo: 1000, departamento: 'Guatemala' })).body;
    await camp({ nombre: 'Pulmón', area: 'RESPIRATORIA', personasAtendidas: 50, costo: 500, departamento: 'Guatemala', estado: 'EN_CURSO' });
    await camp({ nombre: 'Sin costo', personasAtendidas: 200, departamento: 'Petén' });   // sin costo: cuenta como personas, no entra al costo por persona
    const p1 = await paciente(o, { nombreCompleto: 'Uno' }), p2 = await paciente(o, { nombreCompleto: 'Dos' });
    const ref = async (p) => (await http().post('/referidos').set(o.auth).send({ pacienteId: p.id, campanaId: a.id, centroId: c2.entidadId, tipoEstudio: 'Mamografía', consentimiento: true }).expect(201)).body;
    const r1 = await ref(p1); await ref(p2);
    await http().post(`/referidos/${r1.id}/agendar`).set(c2.auth).send({ fecha: haceMeses(0) }).expect(201);
    const e = (await http().get('/estudios').set(c2.auth)).body[0];
    await http().patch(`/estudios/${e.id}`).set(c2.auth).send({ estado: 'REALIZADO' }).expect(200);
    const r = (await http().get('/impacto').set(o.auth).expect(200)).body;
    expect(r.tipo).toBe('ORG');
    expect(r.resumen).toMatchObject({ campanas: 3, enCurso: 1, personas: 350, costo: 1500, campanasConCosto: 2, costoPorPersona: 10 });   // 1500 / (100 + 50), no / 350
    expect(r.porArea.find((x) => x.etiqueta === 'CARDIOVASCULAR')).toMatchObject({ valor: 300, campanas: 2 });
    expect(r.porDepartamento[0]).toMatchObject({ etiqueta: 'Petén', valor: 200 });
    expect(r.porMes.at(-1)).toMatchObject({ mes: mes(0), valor: 350 });
    expect(r.referidos).toMatchObject({ total: 2, atendidos: 1, pendientes: 1, tasaAtencion: 100 });
    expect(r.porCampana.find((x) => x.id === a.id)).toMatchObject({ referidos: 2, atendidos: 1 });
  });

  it('solo administrador y auditor ven los indicadores; operador y sin sesión no', async () => {
    const aud = await crearUsuario(app, centro, 'AUDITOR');
    const op = await crearUsuario(app, centro, 'OPERADOR');
    await http().get('/impacto').set(aud.auth).expect(200);
    await http().get('/impacto').set(op.auth).expect(403);
    await http().get('/impacto').expect(401);
  });

  it('la exportación del reporte queda en la auditoría', async () => {
    await http().post('/bitacora/exportacion').set(centro.auth).send({ recurso: 'impacto', filas: 6 }).expect(201);
    const acciones = (await http().get('/bitacora').set(centro.auth)).body.filter((m) => m.tabla === 'impacto');
    expect(acciones[0]).toMatchObject({ accion: 'EXPORTAR', detalle: { filas: 6 } });
  });
});
