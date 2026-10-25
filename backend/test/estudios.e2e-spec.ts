import request from 'supertest';
import { crearApp, registrar } from './helpers';

describe('estudios', () => {
  let app, a, a2, org, pacienteId;
  beforeAll(async () => {
    app = await crearApp();
    a = await registrar(app, 'CENTRO_DIAGNOSTICO');
    a2 = await registrar(app, 'CENTRO_DIAGNOSTICO');
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
    pacienteId = (await http().post('/pacientes').set(a.auth).send({ nombreCompleto: 'Ana', sexo: 'F' })).body.id;
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());
  const body = () => ({ pacienteId, tipoEstudio: 'Rayos X', fecha: '2026-10-13', hora: '09:30' });

  it('403 si no es CENTRO_DIAGNOSTICO', async () => {
    await http().get('/estudios').set(org.auth).expect(403);
    await http().post('/estudios').set(org.auth).send(body()).expect(403);
  });
  it('crea, lee, actualiza; aislamiento y 404 en id ajeno', async () => {
    const c = await http().post('/estudios').set(a.auth).send(body()).expect(201);
    await http().patch(`/estudios/${c.body.id}`).set(a.auth).send({ resultado: 'Normal' }).expect(200);
    expect((await http().get(`/estudios/${c.body.id}`).set(a.auth).expect(200)).body.resultado).toBe('Normal');
    expect((await http().get('/estudios').set(a2.auth)).body).toHaveLength(0);
    await http().get(`/estudios/${c.body.id}`).set(a2.auth).expect(404);
    await http().patch(`/estudios/${c.body.id}`).set(a2.auth).send({ resultado: 'x' }).expect(404);
  });
  it('paciente ajeno -> 404; validacion -> 400', async () => {
    await http().post('/estudios').set(a2.auth).send(body()).expect(404);
    await http().post('/estudios').set(a.auth).send({ ...body(), fecha: 'ayer' }).expect(400);
    await http().post('/estudios').set(a.auth).send({ ...body(), hora: '99:99' }).expect(400);
    await http().post('/estudios').set(a.auth).send({ tipoEstudio: 'X', fecha: '2026-10-13' }).expect(400);
  });
});
