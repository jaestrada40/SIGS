import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { crearApp, crearUsuario, registrar } from './helpers';

describe('jornada: sincronización de registros hechos sin conexión', () => {
  let app, org, otraOrg, centro, campana;
  const http = () => request(app.getHttpServer());
  const item = (extra = {}, paciente = {}) => ({ claveCliente: randomUUID(), paciente: { nombreCompleto: 'Ana López', sexo: 'F', ...paciente }, ...extra });
  const enviar = (items, auth = org.auth, campanaId = campana.id) => http().post('/jornada/sincronizar').set(auth).send({ campanaId, items });
  const contador = async () => (await http().get('/campanas').set(org.auth)).body.find((c) => c.id === campana.id).personasAtendidas;

  beforeAll(async () => {
    app = await crearApp();
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
    otraOrg = await registrar(app, 'ORG_NO_LUCRATIVA');
    centro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    campana = (await http().post('/campanas').set(org.auth).send({ nombre: 'Jornada rural', area: 'CARDIOVASCULAR', fechaInicio: '2026-10-01' }).expect(201)).body;
  });
  afterAll(() => app.close());

  it('registra personas y atenciones, y suma al contador de la campaña', async () => {
    const r = await enviar([item({}, { nombreCompleto: 'Uno' }), item({}, { nombreCompleto: 'Dos', dpi: '2048173580301', telefono: '5512-3456' })]).expect(201);
    expect(r.body.resultados.map((x) => x.estado)).toEqual(['ok', 'ok']);
    expect(await contador()).toBe(2);
    const dos = (await http().get('/pacientes').set(org.auth)).body.find((p) => p.nombreCompleto === 'Dos');
    expect(dos).toMatchObject({ dpi: '2048173580301', telefono: '55123456' });   // misma normalización que el alta normal
  });

  it('es idempotente: reenviar la misma clave no duplica ni vuelve a contar', async () => {
    const it1 = item({}, { nombreCompleto: 'Reenviada' });
    expect((await enviar([it1])).body.resultados[0].estado).toBe('ok');
    const antes = await contador();
    const otra = await enviar([it1, it1]);   // reintento tras perder la respuesta, incluso repetida en el mismo lote
    expect(otra.body.resultados.map((x) => x.estado)).toEqual(['duplicado', 'duplicado']);
    expect(await contador()).toBe(antes);
    expect((await http().get('/pacientes').set(org.auth)).body.filter((p) => p.nombreCompleto === 'Reenviada')).toHaveLength(1);
  });

  it('dos peticiones simultáneas con la misma clave dejan una sola atención', async () => {
    const it1 = item({}, { nombreCompleto: 'Carrera' });
    const antes = await contador();
    const [a, b] = await Promise.all([enviar([it1]), enviar([it1])]);
    expect([a.body.resultados[0].estado, b.body.resultados[0].estado].sort()).toEqual(['duplicado', 'ok']);
    expect(await contador()).toBe(antes + 1);
  });

  it('una persona con el mismo DPI cuenta una sola vez por campaña y no se duplica como paciente', async () => {
    const dpi = '1234567890101';
    await enviar([item({}, { nombreCompleto: 'Con DPI', dpi })]).expect(201);
    const antes = await contador();
    const r = await enviar([item({}, { nombreCompleto: 'Con DPI otra vez', dpi })]);   // otro dispositivo registra a la misma persona
    expect(r.body.resultados[0]).toMatchObject({ estado: 'repetido' });
    expect(await contador()).toBe(antes);
    expect((await http().get('/pacientes').set(org.auth)).body.filter((p) => p.dpi === dpi)).toHaveLength(1);
  });

  it('un registro inválido no tumba el lote: se informa por registro y los demás se guardan', async () => {
    const antes = await contador();
    const r = await enviar([item({}, { nombreCompleto: 'Válida' }), item({}, { dpi: '123' }), { claveCliente: 'no-es-uuid', paciente: { nombreCompleto: 'X', sexo: 'F' } }, item({ atendidoEn: '2999-01-01T00:00:00Z' })]);
    expect(r.body.resultados.map((x) => x.estado)).toEqual(['ok', 'error', 'error', 'error']);
    expect(r.body.resultados[1].mensaje).toMatch(/DPI/);
    expect(await contador()).toBe(antes + 1);
  });

  it('los límites del lote y la campaña ajena o inexistente se rechazan', async () => {
    await enviar([]).expect(400);
    await enviar(Array.from({ length: 101 }, () => item())).expect(400);
    await enviar([item()], otraOrg.auth).expect(404);          // campaña de otra organización
    await enviar([item()], org.auth, 9999).expect(404);
  });

  it('solo un organismo con rol de escritura; un centro y el auditor no', async () => {
    await enviar([item()], centro.auth).expect(403);
    const aud = await crearUsuario(app, org, 'AUDITOR');
    await enviar([item()], aud.auth).expect(403);
    await http().post('/jornada/sincronizar').send({ campanaId: campana.id, items: [item()] }).expect(401);
    const op = await crearUsuario(app, org, 'OPERADOR');
    await enviar([item({}, { nombreCompleto: 'Operador' })], op.auth).expect(201);
  });

  it('queda en la auditoría sin datos personales', async () => {
    const r = await enviar([item({}, { nombreCompleto: 'Persona Auditada', dpi: '1111111111111' })]);
    expect(r.body.resultados[0].estado).toBe('ok');
    const log = (await http().get('/bitacora').set(org.auth)).body;
    expect(log.filter((m) => m.tabla === 'atencion').length).toBeGreaterThan(0);
    expect(JSON.stringify(log)).not.toMatch(/Persona Auditada|1111111111111/);
    const [{ n }] = await app.get(DataSource).query('SELECT COUNT(*)::int n FROM atencion WHERE "entidadId" = $1', [org.entidadId]);
    expect(n).toBeGreaterThan(5);
  });
});
