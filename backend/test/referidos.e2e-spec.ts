import request from 'supertest';
import { DataSource } from 'typeorm';
import { crearApp, crearUsuario, registrar } from './helpers';

describe('referidos: del organismo al centro de diagnóstico', () => {
  let app, org, centro, otroCentro, otroOrg, persona, campana;
  const http = () => request(app.getHttpServer());
  const nuevo = (extra = {}) => ({ pacienteId: persona.id, campanaId: campana.id, centroId: centro.entidadId, tipoEstudio: 'Mamografía', consentimiento: true, ...extra });
  const enviar = async (extra = {}) => (await http().post('/referidos').set(org.auth).send(nuevo(extra)).expect(201)).body;

  beforeAll(async () => {
    app = await crearApp();
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
    otroOrg = await registrar(app, 'ORG_NO_LUCRATIVA');
    centro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    otroCentro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    persona = (await http().post('/pacientes').set(org.auth).send({ nombreCompleto: 'Ana López', sexo: 'F', dpi: '2048173580301', fechaNacimiento: '1985-03-12', telefono: '55123456' }).expect(201)).body;
    campana = (await http().post('/campanas').set(org.auth).send({ nombre: 'Jornada', area: 'ONCOLOGICO_OTRO', fechaInicio: '2026-10-01' }).expect(201)).body;
  });
  afterAll(() => app.close());

  it('el organismo ve el directorio de centros; el centro no', async () => {
    const d = (await http().get('/referidos/centros').set(org.auth).expect(200)).body;
    expect(d.map((c) => c.id)).toEqual(expect.arrayContaining([centro.entidadId, otroCentro.entidadId]));
    expect(d.map((c) => c.id)).not.toContain(org.entidadId);   // solo centros de diagnóstico
    expect(JSON.stringify(d)).not.toMatch(/correo|telefono|passwordHash/);   // nada más que id, nombre y departamento
    await http().get('/referidos/centros').set(centro.auth).expect(403);
  });

  it('crea un referido pendiente con código, y exige el consentimiento de la persona', async () => {
    const r = await enviar();
    expect(r).toMatchObject({ estado: 'PENDIENTE', tipoEstudio: 'Mamografía', nombreCompleto: 'Ana López' });
    expect(r.codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await http().post('/referidos').set(org.auth).send(nuevo({ consentimiento: false })).expect(400);
    const sin = nuevo(); delete (sin as { consentimiento?: boolean }).consentimiento;
    await http().post('/referidos').set(org.auth).send(sin).expect(400);
  });

  it('valida a quién se refiere: persona y campaña propias, y un centro que exista', async () => {
    await http().post('/referidos').set(otroOrg.auth).send(nuevo()).expect(404);                 // la persona es de otro organismo
    await http().post('/referidos').set(org.auth).send(nuevo({ campanaId: 9999 })).expect(404);   // campaña inexistente
    await http().post('/referidos').set(org.auth).send(nuevo({ centroId: otroOrg.entidadId })).expect(404);   // no es un centro
    await http().post('/referidos').set(org.auth).send(nuevo({ centroId: 9999 })).expect(404);
  });

  it('solo un organismo envía y solo un centro agenda', async () => {
    await http().post('/referidos').set(centro.auth).send(nuevo()).expect(403);
    const r = await enviar();
    await http().post(`/referidos/${r.id}/agendar`).set(org.auth).send({ fecha: '2026-11-10' }).expect(403);
  });

  it('el centro recibe una copia mínima; otro centro y otro organismo no ven nada', async () => {
    const r = await enviar({ tipoEstudio: 'Ultrasonido mamario' });
    const recibidos = (await http().get('/referidos').set(centro.auth).expect(200)).body;
    const mio = recibidos.find((x) => x.id === r.id);
    expect(mio).toMatchObject({ nombreCompleto: 'Ana López', dpi: '2048173580301', tipoEstudio: 'Ultrasonido mamario', estado: 'PENDIENTE' });
    expect(JSON.stringify(mio)).not.toMatch(/entidadOrigenId|entidadDestinoId/);
    expect((await http().get('/referidos').set(otroCentro.auth).expect(200)).body.map((x) => x.id)).not.toContain(r.id);
    expect((await http().get('/referidos').set(otroOrg.auth).expect(200)).body.map((x) => x.id)).not.toContain(r.id);
    await http().post(`/referidos/${r.id}/agendar`).set(otroCentro.auth).send({ fecha: '2026-11-10' }).expect(404);   // ajeno: 404, no 403
    await http().post(`/referidos/${r.id}/cancelar`).set(otroOrg.auth).expect(404);
  });

  it('flujo completo: agendar crea la persona y el estudio en el centro; al realizarse, el referido queda atendido sin exponer el resultado', async () => {
    const r = await enviar({ tipoEstudio: 'Mamografía bilateral' });
    await http().post(`/referidos/${r.id}/agendar`).set(centro.auth).send({ fecha: '2026-11-10', hora: '09:30' }).expect(201);
    const pacientes = (await http().get('/pacientes').set(centro.auth).expect(200)).body;
    const p = pacientes.find((x) => x.dpi === '2048173580301');
    expect(p).toMatchObject({ nombreCompleto: 'Ana López', telefono: '55123456' });
    const estudio = (await http().get('/estudios').set(centro.auth).expect(200)).body.find((e) => e.tipoEstudio === 'Mamografía bilateral');
    expect(estudio).toMatchObject({ pacienteId: p.id, fecha: '2026-11-10', estado: 'PROGRAMADO' });
    // el organismo ya lo ve agendado, sin el estudio del centro
    const vista = (await http().get('/referidos').set(org.auth)).body.find((x) => x.id === r.id);
    expect(vista).toMatchObject({ estado: 'AGENDADO', fechaCita: '2026-11-10' });
    expect(vista.estudioId).toBeUndefined();
    // el centro realiza el estudio y registra un resultado clínico
    await http().patch(`/estudios/${estudio.id}`).set(centro.auth).send({ estado: 'REALIZADO', resultado: 'Hallazgo clínico muy sensible' }).expect(200);
    const final = (await http().get('/referidos').set(org.auth)).body.find((x) => x.id === r.id);
    expect(final.estado).toBe('ATENDIDO');
    expect(final.atendidoEn).toBeTruthy();
    expect(JSON.stringify(final)).not.toMatch(/sensible|resultado/);   // el organismo nunca ve el resultado
  });

  it('si la persona ya existe en el centro (mismo DPI) se reutiliza, no se duplica', async () => {
    const r = await enviar({ tipoEstudio: 'Papanicolaou' });
    await http().post(`/referidos/${r.id}/agendar`).set(centro.auth).send({ fecha: '2026-11-12' }).expect(201);
    const con = (await http().get('/pacientes').set(centro.auth)).body.filter((x) => x.dpi === '2048173580301');
    expect(con).toHaveLength(1);
  });

  it('máquina de estados: no se agenda dos veces, no se cancela lo agendado y «no llegó» cierra', async () => {
    const a = await enviar();
    await http().post(`/referidos/${a.id}/agendar`).set(centro.auth).send({ fecha: '2026-11-15' }).expect(201);
    await http().post(`/referidos/${a.id}/agendar`).set(centro.auth).send({ fecha: '2026-11-16' }).expect(409);
    await http().post(`/referidos/${a.id}/cancelar`).set(org.auth).expect(409);
    await http().post(`/referidos/${a.id}/no-llego`).set(centro.auth).expect(201);
    await http().post(`/referidos/${a.id}/no-llego`).set(centro.auth).expect(409);
    const b = await enviar();
    await http().post(`/referidos/${b.id}/cancelar`).set(org.auth).expect(201);
    await http().post(`/referidos/${b.id}/agendar`).set(centro.auth).send({ fecha: '2026-11-15' }).expect(409);
    const estados = (await http().get('/referidos').set(org.auth)).body;
    expect(estados.find((x) => x.id === a.id).estado).toBe('NO_LLEGO');
    expect(estados.find((x) => x.id === b.id).estado).toBe('CANCELADO');
  });

  it('el rol Auditor puede consultar pero no enviar ni agendar', async () => {
    const aud = await crearUsuario(app, org, 'AUDITOR');
    await http().get('/referidos').set(aud.auth).expect(200);
    await http().post('/referidos').set(aud.auth).send(nuevo()).expect(403);
    const audCentro = await crearUsuario(app, centro, 'AUDITOR');
    const r = await enviar();
    await http().post(`/referidos/${r.id}/agendar`).set(audCentro.auth).send({ fecha: '2026-11-10' }).expect(403);
  });

  it('las acciones quedan en la auditoría de cada entidad, sin datos personales', async () => {
    const r = await enviar();
    await http().post(`/referidos/${r.id}/agendar`).set(centro.auth).send({ fecha: '2026-11-20' }).expect(201);
    const deOrg = (await http().get('/bitacora').set(org.auth)).body.filter((m) => m.tabla === 'referido' && m.registroId === r.id);
    const deCentro = (await http().get('/bitacora').set(centro.auth)).body.filter((m) => m.tabla === 'referido' && m.registroId === r.id);
    expect(deOrg.map((m) => m.accion)).toEqual(['CREAR']);
    expect(deCentro.map((m) => m.accion)).toEqual(['MODIFICAR']);
    expect(JSON.stringify([deOrg, deCentro])).not.toMatch(/Ana|2048173580301/);
  });

  it('el referido guarda la fecha del consentimiento', async () => {
    const r = await enviar();
    const [fila] = await app.get(DataSource).query('SELECT "consentimientoEn" FROM referido WHERE id = $1', [r.id]);
    expect(new Date(fila.consentimientoEn).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});
