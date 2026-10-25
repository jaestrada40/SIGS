import request from 'supertest';
import { crearApp, registrar } from './helpers';

describe('pacientes', () => {
  let app, a, b;
  beforeAll(async () => {
    app = await crearApp();
    a = await registrar(app, 'CENTRO_DIAGNOSTICO');
    b = await registrar(app, 'ORG_NO_LUCRATIVA');
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  it('crea, lista y actualiza; aislamiento entre entidades; 404 en id ajeno', async () => {
    const c = await http().post('/pacientes').set(a.auth).send({ nombreCompleto: 'Ana', sexo: 'F' }).expect(201);
    expect(c.body.entidadId).toBeDefined();
    await http().patch(`/pacientes/${c.body.id}`).set(a.auth).send({ departamento: 'Guatemala', municipio: 'Mixco' }).expect(200);
    expect((await http().get(`/pacientes/${c.body.id}`).set(a.auth).expect(200)).body.municipio).toBe('Mixco');
    expect((await http().get('/pacientes').set(a.auth)).body).toHaveLength(1);
    expect((await http().get('/pacientes').set(b.auth)).body).toHaveLength(0);
    await http().get(`/pacientes/${c.body.id}`).set(b.auth).expect(404);
    await http().patch(`/pacientes/${c.body.id}`).set(b.auth).send({ departamento: 'Guatemala', municipio: 'Mixco' }).expect(404);
  });
  it('validacion -> 400 y entidadId del body se ignora', async () => {
    await http().post('/pacientes').set(a.auth).send({ nombreCompleto: '', sexo: 'F' }).expect(400);
    await http().post('/pacientes').set(a.auth).send({ nombreCompleto: 'Z', sexo: 'Q' }).expect(400);
    const r = await http().post('/pacientes').set(b.auth).send({ nombreCompleto: 'Z', sexo: 'M', entidadId: 999 }).expect(201);
    expect(r.body.entidadId).not.toBe(999);
  });
  it('dashboard con totales de la entidad', async () => {
    expect((await http().get('/dashboard').set(a.auth).expect(200)).body).toEqual({ totalPacientes: 1, totalEstudios: 0 });
    expect((await http().get('/dashboard').set(b.auth).expect(200)).body).toEqual({ totalPacientes: 1, totalCampanas: 0, totalPersonasAtendidas: 0 });
  });
});
