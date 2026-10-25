import { authenticator } from 'otplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { codigoSiguiente, crearApp, registrar } from './helpers';

describe('auth + MFA', () => {
  let app;
  const http = () => request(app.getHttpServer());
  const login = (correo: string, password = 'secreto1234') => http().post('/auth/login').send({ correo, password });
  beforeAll(async () => (app = await crearApp()));
  afterAll(() => app.close());

  it('registro no da sesión: solo un token de configuración de MFA', async () => {
    const res = await http().post('/auth/registro').send({ nombre: 'X', tipo: 'ORG_NO_LUCRATIVA', correo: 'nuevo@test.com', password: 'secreto1234' });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('mfa_configurar');
    expect(res.body.access_token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    // el token parcial NO abre la API
    await http().get('/pacientes').set('Authorization', `Bearer ${res.body.setup_token}`).expect(401);
  });

  it('flujo completo: activar MFA, login pide código, código correcto da sesión', async () => {
    const { correo, secreto, recuperacion, token } = await registrar(app, 'CENTRO_DIAGNOSTICO');
    expect(recuperacion).toHaveLength(8);
    await http().get('/pacientes').set('Authorization', `Bearer ${token}`).expect(200);
    const l = await login(correo);
    expect(l.body.estado).toBe('mfa_requerido');
    expect(l.body.access_token).toBeUndefined();
    await http().get('/dashboard').set('Authorization', `Bearer ${l.body.mfa_token}`).expect(401);
    const ok = await http().post('/auth/mfa/verificar').send({ mfa_token: l.body.mfa_token, codigo: codigoSiguiente(secreto) });
    expect(ok.status).toBe(201);
    expect(ok.body.access_token).toBeDefined();
    expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash|mfaSecreto/);
  });

  it('un código TOTP ya usado no sirve otra vez (anti-reutilización)', async () => {
    const { correo, secreto } = await registrar(app, 'CENTRO_DIAGNOSTICO');
    // registrar() ya consumió el código del paso actual al activar
    const l = await login(correo);
    const r = await http().post('/auth/mfa/verificar').send({ mfa_token: l.body.mfa_token, codigo: authenticator.generate(secreto) });
    expect(r.status).toBe(401);
  });

  it('código de recuperación: sirve una sola vez', async () => {
    const { correo, recuperacion } = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const a = await login(correo);
    await http().post('/auth/mfa/verificar').send({ mfa_token: a.body.mfa_token, codigo: recuperacion[0] }).expect(201);
    const b = await login(correo);
    await http().post('/auth/mfa/verificar').send({ mfa_token: b.body.mfa_token, codigo: recuperacion[0] }).expect(401);
    await http().post('/auth/mfa/verificar').send({ mfa_token: b.body.mfa_token, codigo: recuperacion[1].toLowerCase() }).expect(201);
  });

  it('el secreto de MFA se guarda cifrado y los códigos de recuperación como hash', async () => {
    const { correo, secreto, recuperacion } = await registrar(app, 'ORG_NO_LUCRATIVA');
    const [fila] = await app.get(DataSource).query('SELECT "mfaSecreto", "mfaRecuperacion" FROM usuario WHERE correo = $1', [correo]);
    expect(fila.mfaSecreto).not.toContain(secreto);
    expect(JSON.stringify(fila.mfaRecuperacion)).not.toContain(recuperacion[0].replace('-', ''));
  });

  it('login con password mala -> 401 sin revelar si el correo existe', async () => {
    const { correo } = await registrar(app, 'ORG_NO_LUCRATIVA');
    const mala = await login(correo, 'incorrecta123');
    const inexistente = await login('nadie@test.com');
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body).toEqual(inexistente.body);
  });

  it('5 fallos seguidos bloquean la cuenta (429), incluso con la clave correcta', async () => {
    const { correo } = await registrar(app, 'ORG_NO_LUCRATIVA');
    for (let i = 0; i < 5; i++) await login(correo, 'incorrecta123').expect(401);
    await login(correo).expect(429);
  });

  it('cerrar sesión en el servidor revoca el token, y un nuevo login sigue funcionando', async () => {
    const { token, correo, secreto } = await registrar(app, 'CENTRO_DIAGNOSTICO');
    await http().get('/pacientes').set('Authorization', `Bearer ${token}`).expect(200);
    await http().post('/auth/logout').set('Authorization', `Bearer ${token}`).expect(201);
    await http().get('/pacientes').set('Authorization', `Bearer ${token}`).expect(401);
    await http().post('/auth/logout').expect(401);
    await new Promise((r) => setTimeout(r, 5));
    const l = await login(correo);
    const ok = await http().post('/auth/mfa/verificar').send({ mfa_token: l.body.mfa_token, codigo: codigoSiguiente(secreto) });
    await http().get('/pacientes').set('Authorization', `Bearer ${ok.body.access_token}`).expect(200);
  });

  it('un correo inexistente también se bloquea igual (429): el bloqueo no revela cuentas', async () => {
    for (let i = 0; i < 5; i++) await login('fantasma@test.com', 'incorrecta123').expect(401);
    await login('fantasma@test.com').expect(429);
  });

  it('correo duplicado -> 409', async () => {
    const { correo } = await registrar(app, 'ORG_NO_LUCRATIVA');
    await http().post('/auth/registro').send({ nombre: 'X', tipo: 'ORG_NO_LUCRATIVA', correo, password: 'secreto1234' }).expect(409);
  });

  it('validación -> 400 (tipo inválido, password corta, correo inválido)', async () => {
    const s = (b) => http().post('/auth/registro').send(b);
    await s({ nombre: 'X', tipo: 'OTRO', correo: 'a@b.com', password: 'secreto1234' }).expect(400);
    await s({ nombre: 'X', tipo: 'ORG_NO_LUCRATIVA', correo: 'a@b.com', password: '123456789' }).expect(400);
    await s({ nombre: 'X', tipo: 'ORG_NO_LUCRATIVA', correo: 'no-correo', password: 'secreto1234' }).expect(400);
  });

  it('rutas protegidas sin token -> 401', async () => {
    await http().get('/pacientes').expect(401);
    await http().get('/dashboard').expect(401);
    await http().get('/salud').expect(200);   // la comprobación de salud del contenedor no exige sesión
  });
});
