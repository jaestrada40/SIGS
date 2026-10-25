import request from 'supertest';
import { crearApp, registrar } from './helpers';

describe('campanas', () => {
  let app, o, o2, centro;
  beforeAll(async () => {
    app = await crearApp();
    o = await registrar(app, 'ORG_NO_LUCRATIVA');
    o2 = await registrar(app, 'ORG_NO_LUCRATIVA');
    centro = await registrar(app, 'CENTRO_DIAGNOSTICO');
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());
  const body = { nombre: 'Jornada', area: 'CARDIOVASCULAR', fechaInicio: '2026-11-01', personasAtendidas: 40 };

  it('403 si no es ORG_NO_LUCRATIVA', async () => {
    await http().get('/campanas').set(centro.auth).expect(403);
    await http().post('/campanas').set(centro.auth).send(body).expect(403);
  });
  it('crea, actualiza; aislamiento y 404 en id ajeno; dashboard', async () => {
    const c = await http().post('/campanas').set(o.auth).send(body).expect(201);
    expect(c.body.estado).toBe('PROGRAMADA');
    await http().patch(`/campanas/${c.body.id}`).set(o.auth).send({ estado: 'EN_CURSO' }).expect(200);
    expect((await http().get(`/campanas/${c.body.id}`).set(o.auth).expect(200)).body.estado).toBe('EN_CURSO');
    expect((await http().get('/campanas').set(o2.auth)).body).toHaveLength(0);
    await http().get(`/campanas/${c.body.id}`).set(o2.auth).expect(404);
    await http().patch(`/campanas/${c.body.id}`).set(o2.auth).send({ estado: 'FINALIZADA' }).expect(404);
    expect((await http().get('/dashboard').set(o.auth)).body).toEqual({ totalPacientes: 0, totalCampanas: 1, totalPersonasAtendidas: 40 });
  });
  it('validacion -> 400', async () => {
    await http().post('/campanas').set(o.auth).send({ ...body, area: 'OTRA' }).expect(400);
    await http().post('/campanas').set(o.auth).send({ ...body, estado: 'X' }).expect(400);
    await http().post('/campanas').set(o.auth).send({ ...body, personasAtendidas: -1 }).expect(400);
    await http().post('/campanas').set(o.auth).send({ area: 'CARDIOVASCULAR' }).expect(400);
  });
});
