import request from 'supertest';
import { DataSource } from 'typeorm';
import { crearApp, entrar, registrar, superadmin } from './helpers';

describe('plataforma: alta de entidades por invitación', () => {
  let app;
  const http = () => request(app.getHttpServer());
  const nueva = (sa, correo, extra = {}) => http().post('/plataforma/entidades').set(sa.auth).send({ nombre: 'Centro Nuevo', tipo: 'CENTRO_DIAGNOSTICO', correo, ...extra });
  beforeAll(async () => (app = await crearApp()));
  afterAll(() => app.close());

  it('flujo completo: el superadmin crea, la entidad acepta el enlace, configura MFA y entra', async () => {
    const sa = await superadmin(app);
    const c = await nueva(sa, 'centro@test.com');
    expect(c.status).toBe(201);
    expect(c.body.entidad.tipo).toBe('CENTRO_DIAGNOSTICO');
    expect(JSON.stringify(c.body)).not.toMatch(/passwordHash|invitacionHash/);
    // hasta aceptar, nadie puede entrar con esa cuenta
    await http().post('/auth/login').send({ correo: 'centro@test.com', password: 'secreto1234' }).expect(401);
    const g = await http().get(`/auth/invitacion/${c.body.invitacion}`).expect(200);
    expect(g.body).toEqual({ entidad: 'Centro Nuevo', correo: 'centro@test.com' });
    const a = await http().post(`/auth/invitacion/${c.body.invitacion}`).send({ password: 'ClaveNueva#2026' }).expect(201);
    expect(a.body.estado).toBe('mfa_configurar');
    const s = await entrar(app, 'centro@test.com', 'ClaveNueva#2026');
    await http().get('/pacientes').set(s.auth).expect(200);
    // el enlace sirve una sola vez
    await http().get(`/auth/invitacion/${c.body.invitacion}`).expect(404);
    await http().post(`/auth/invitacion/${c.body.invitacion}`).send({ password: 'OtraClave#2026' }).expect(404);
    const l = await http().get('/plataforma/entidades').set(sa.auth).expect(200);
    expect(l.body.find((e) => e.correo === 'centro@test.com').estado).toBe('activa');
  });

  it('invitación vencida o inventada -> 404; contraseña corta -> 400', async () => {
    const sa = await superadmin(app);
    const c = await nueva(sa, 'vence@test.com');
    await http().get('/auth/invitacion/inventado').expect(404);
    await http().post(`/auth/invitacion/${c.body.invitacion}`).send({ password: 'corta' }).expect(400);
    await app.get(DataSource).query(`UPDATE usuario SET "invitacionVence" = now() - interval '1 hour' WHERE correo = 'vence@test.com'`);
    await http().get(`/auth/invitacion/${c.body.invitacion}`).expect(404);
    const l = await http().get('/plataforma/entidades').set(sa.auth);
    expect(l.body.find((e) => e.correo === 'vence@test.com').estado).toBe('invitacion_vencida');
    // un enlace nuevo reemplaza al vencido y al anterior
    const r = await http().post(`/plataforma/entidades/${c.body.entidad.id}/invitacion`).set(sa.auth).expect(201);
    await http().get(`/auth/invitacion/${c.body.invitacion}`).expect(404);
    await http().get(`/auth/invitacion/${r.body.invitacion}`).expect(200);
  });

  it('no se puede reinvitar a una entidad que ya activó su acceso', async () => {
    const sa = await superadmin(app);
    const e = await registrar(app, 'ORG_NO_LUCRATIVA');
    await http().post(`/plataforma/entidades/${e.entidadId}/invitacion`).set(sa.auth).expect(409);
  });

  it('validación: tipo inválido o PLATAFORMA -> 400; correo repetido -> 409', async () => {
    const sa = await superadmin(app);
    await nueva(sa, 'a@test.com', { tipo: 'OTRO' }).expect(400);
    await nueva(sa, 'a@test.com', { tipo: 'PLATAFORMA' }).expect(400);
    await nueva(sa, 'no-correo').expect(400);
    await nueva(sa, 'dup@test.com').expect(201);
    await nueva(sa, 'dup@test.com').expect(409);
  });

  it('solo el superadmin entra a /plataforma, y el superadmin no toca datos de pacientes', async () => {
    const sa = await superadmin(app);
    const e = await registrar(app, 'CENTRO_DIAGNOSTICO');
    await http().get('/plataforma/entidades').set(e.auth).expect(403);
    await http().post('/plataforma/entidades').set(e.auth).send({ nombre: 'X', tipo: 'CENTRO_DIAGNOSTICO', correo: 'x@test.com' }).expect(403);
    await http().get('/plataforma/entidades').expect(401);
    await http().get('/pacientes').set(sa.auth).expect(403);
    await http().get('/usuarios').set(sa.auth).expect(403);
    await http().post('/auth/logout').set(sa.auth).expect(201);
  });

  it('un SUPERADMIN fuera de la entidad de plataforma no puede actuar', async () => {
    const sa = await superadmin(app);
    await app.get(DataSource).query(`UPDATE entidad SET tipo = 'CENTRO_DIAGNOSTICO' WHERE correo = $1`, [sa.correo]);
    await http().get('/plataforma/entidades').set(sa.auth).expect(403);
    await nueva(sa, 'fuera@test.com').expect(403);
  });
});
