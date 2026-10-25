import request from 'supertest';
import { DataSource } from 'typeorm';
import { codigoSiguiente, crearApp, crearUsuario, entrar, registrar } from './helpers';

describe('usuarios, roles y auditoría', () => {
  let app;
  const http = () => request(app.getHttpServer());
  const paciente = { nombreCompleto: 'Ana López', sexo: 'F' };
  beforeAll(async () => (app = await crearApp()));
  afterAll(() => app.close());

  it('ADMIN crea, lista y actualiza usuarios; la respuesta nunca trae secretos', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    expect(op.res.status).toBe(201);
    expect(JSON.stringify(op.res.body)).not.toMatch(/passwordHash|mfaSecreto|mfaRecuperacion/);
    const lista = await http().get('/usuarios').set(admin.auth).expect(200);
    expect(lista.body).toHaveLength(2);
    const r = await http().patch(`/usuarios/${op.id}`).set(admin.auth).send({ nombre: 'Nuevo Nombre' }).expect(200);
    expect(r.body.nombre).toBe('Nuevo Nombre');
    await http().post('/usuarios').set(admin.auth).send({ nombre: 'X', correo: op.correo, rol: 'OPERADOR', password: 'ClaveInicial#2026' }).expect(409);
    await http().post('/usuarios').set(admin.auth).send({ nombre: 'X', correo: 'z@test.com', rol: 'SUPERMAN', password: 'ClaveInicial#2026' }).expect(400);
    await http().post('/usuarios').set(admin.auth).send({ nombre: 'X', correo: 'z@test.com', rol: 'OPERADOR', password: 'corta' }).expect(400);
  });

  it('solo ADMIN gestiona usuarios; OPERADOR y AUDITOR reciben 403', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    for (const rol of ['OPERADOR', 'AUDITOR'] as const) {
      const u = await crearUsuario(app, admin, rol);
      await http().get('/usuarios').set(u.auth).expect(403);
      await http().post('/usuarios').set(u.auth).send({ nombre: 'X', correo: 'q@test.com', rol: 'ADMIN', password: 'ClaveInicial#2026' }).expect(403);
    }
  });

  it('AUDITOR lee pero no escribe; OPERADOR escribe pero no ve la auditoría', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const aud = await crearUsuario(app, admin, 'AUDITOR');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    await http().post('/pacientes').set(op.auth).send(paciente).expect(201);
    await http().get('/pacientes').set(aud.auth).expect(200);
    await http().post('/pacientes').set(aud.auth).send(paciente).expect(403);
    await http().get('/bitacora').set(aud.auth).expect(200);
    await http().get('/bitacora').set(op.auth).expect(403);
  });

  it('la auditoría dice quién hizo cada cosa, incluidos los eventos de seguridad', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    await http().post('/pacientes').set(op.auth).send(paciente).expect(201);
    const b = (await http().get('/bitacora').set(admin.auth).expect(200)).body;
    const crear = b.find((m) => m.tabla === 'paciente' && m.accion === 'CREAR');
    expect(crear.usuario.correo).toBe(op.correo);
    expect(crear.usuario.rol).toBe('OPERADOR');
    expect(b.map((m) => m.accion)).toEqual(expect.arrayContaining(['INICIO_SESION', 'MFA_ACTIVADO', 'CREAR']));
    expect(JSON.stringify(b)).not.toMatch(/passwordHash|mfaSecreto/);
  });

  it('aislamiento: un administrador no ve ni toca usuarios de otra entidad (404)', async () => {
    const a = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const b = await registrar(app, 'ORG_NO_LUCRATIVA');
    const ub = await crearUsuario(app, b, 'OPERADOR');
    expect((await http().get('/usuarios').set(a.auth)).body.map((u) => u.id)).not.toContain(ub.id);
    await http().patch(`/usuarios/${ub.id}`).set(a.auth).send({ rol: 'ADMIN' }).expect(404);
    await http().post(`/usuarios/${ub.id}/restablecer-mfa`).set(a.auth).expect(404);
    await http().post(`/usuarios/${ub.id}/restablecer-password`).set(a.auth).send({ password: 'OtraClave#2026' }).expect(404);
  });

  it('el administrador no puede degradarse, desactivarse ni restablecerse a sí mismo', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const yo = (await http().get('/usuarios').set(admin.auth)).body[0].id;
    await http().patch(`/usuarios/${yo}`).set(admin.auth).send({ rol: 'AUDITOR' }).expect(403);
    await http().patch(`/usuarios/${yo}`).set(admin.auth).send({ activo: false }).expect(403);
    await http().post(`/usuarios/${yo}/restablecer-mfa`).set(admin.auth).expect(403);
    await http().post(`/usuarios/${yo}/restablecer-password`).set(admin.auth).send({ password: 'OtraClave#2026' }).expect(403);
    await http().patch(`/usuarios/${yo}`).set(admin.auth).send({ nombre: 'Yo mismo' }).expect(200);
  });

  it('desactivar o cambiar el rol surte efecto de inmediato sobre el token vigente', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    await http().patch(`/usuarios/${op.id}`).set(admin.auth).send({ rol: 'AUDITOR' }).expect(200);
    await http().get('/pacientes').set(op.auth).expect(401);   // la sesión se revocó: debe volver a entrar
    const otra = await crearUsuario(app, admin, 'OPERADOR');
    await http().patch(`/usuarios/${otra.id}`).set(admin.auth).send({ activo: false }).expect(200);
    await http().get('/pacientes').set(otra.auth).expect(401);
    expect((await http().post('/auth/login').send({ correo: otra.correo, password: 'ClaveInicial#2026' })).status).toBe(401);   // desactivado: ni siquiera inicia
    await http().patch(`/usuarios/${otra.id}`).set(admin.auth).send({ activo: true }).expect(200);
    expect((await http().post('/auth/login').send({ correo: otra.correo, password: 'ClaveInicial#2026' })).status).toBe(201);
  });

  it('restablecer MFA: pide configurarlo de nuevo y borra el secreto viejo', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    await http().post(`/usuarios/${op.id}/restablecer-mfa`).set(admin.auth).expect(201);
    const [fila] = await app.get(DataSource).query('SELECT "mfaActivo","mfaSecreto","mfaRecuperacion" FROM usuario WHERE id=$1', [op.id]);
    expect(fila).toEqual({ mfaActivo: false, mfaSecreto: null, mfaRecuperacion: null });
    const l = await http().post('/auth/login').send({ correo: op.correo, password: 'ClaveInicial#2026' });
    expect(l.body.estado).toBe('mfa_configurar');
    expect((await entrar(app, op.correo, 'ClaveInicial#2026')).token).toBeDefined();
  });

  it('restablecer contraseña: la vieja deja de servir y la sesión anterior se cierra', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    await http().post(`/usuarios/${op.id}/restablecer-password`).set(admin.auth).send({ password: 'ClaveNueva#2026' }).expect(201);
    await http().get('/pacientes').set(op.auth).expect(401);
    await http().post('/auth/login').send({ correo: op.correo, password: 'ClaveInicial#2026' }).expect(401);
    expect((await http().post('/auth/login').send({ correo: op.correo, password: 'ClaveNueva#2026' })).body.estado).toBe('mfa_requerido');
  });

  it('cambiar la propia contraseña: exige la actual, valida la nueva y devuelve sesión nueva', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    await http().post('/auth/cambiar-password').send({ actual: 'secreto1234', nueva: 'NuevaClave#2026' }).expect(401);
    await http().post('/auth/cambiar-password').set(admin.auth).send({ actual: 'incorrecta12', nueva: 'NuevaClave#2026' }).expect(400);
    await http().post('/auth/cambiar-password').set(admin.auth).send({ actual: 'secreto1234', nueva: 'secreto1234' }).expect(400);
    await http().post('/auth/cambiar-password').set(admin.auth).send({ actual: 'secreto1234', nueva: 'corta' }).expect(400);
    const r = await http().post('/auth/cambiar-password').set(admin.auth).send({ actual: 'secreto1234', nueva: 'NuevaClave#2026' }).expect(201);
    await http().get('/pacientes').set(admin.auth).expect(401);   // el token anterior murió
    await http().get('/pacientes').set({ Authorization: `Bearer ${r.body.access_token}` }).expect(200);
    await http().post('/auth/login').send({ correo: admin.correo, password: 'secreto1234' }).expect(401);
  });
  it('las exportaciones quedan en la auditoría (quién, qué, cuántas filas) y las pueden hacer todos los roles de lectura', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const op = await crearUsuario(app, admin, 'OPERADOR');
    const aud = await crearUsuario(app, admin, 'AUDITOR');
    await http().post('/bitacora/exportacion').send({ recurso: 'paciente', filas: 3 }).expect(401);
    await http().post('/bitacora/exportacion').set(op.auth).send({ recurso: 'paciente', filas: 12 }).expect(201);
    await http().post('/bitacora/exportacion').set(aud.auth).send({ recurso: 'bitacora', filas: 5 }).expect(201);
    await http().post('/bitacora/exportacion').set(op.auth).send({ recurso: 'usuario', filas: 1 }).expect(400);
    await http().post('/bitacora/exportacion').set(op.auth).send({ recurso: 'paciente', filas: -1 }).expect(400);
    await http().post('/bitacora/exportacion').set(op.auth).send({ recurso: 'paciente', filas: 2_000_000 }).expect(400);
    const b = (await http().get('/bitacora').set(admin.auth).expect(200)).body.filter((m) => m.accion === 'EXPORTAR');
    expect(b).toHaveLength(2);
    const p = b.find((m) => m.tabla === 'paciente');
    expect(p.detalle).toEqual({ filas: 12 });
    expect(p.usuario.correo).toBe(op.correo);
    expect(b.find((m) => m.tabla === 'bitacora').usuario.rol).toBe('AUDITOR');
  });
  it('los tokens parciales de MFA también se revocan al restablecer la contraseña o el MFA', async () => {
    const admin = await registrar(app, 'CENTRO_DIAGNOSTICO');
    // usuario sin MFA: su token de configuración deja de servir tras restablecerle la contraseña
    const nuevo = await crearUsuario(app, admin, 'OPERADOR');
    await http().post(`/usuarios/${nuevo.id}/restablecer-mfa`).set(admin.auth).expect(201);
    const l1 = await http().post('/auth/login').send({ correo: nuevo.correo, password: 'ClaveInicial#2026' });
    expect(l1.body.estado).toBe('mfa_configurar');
    await http().post(`/usuarios/${nuevo.id}/restablecer-password`).set(admin.auth).send({ password: 'ClaveNueva#2026' }).expect(201);
    await http().post('/auth/mfa/configurar').set('Authorization', `Bearer ${l1.body.setup_token}`).expect(401);
    // usuario con MFA: su token de verificación deja de servir tras restablecerle el MFA
    const con = await crearUsuario(app, admin, 'OPERADOR');
    const l2 = await http().post('/auth/login').send({ correo: con.correo, password: 'ClaveInicial#2026' });
    expect(l2.body.estado).toBe('mfa_requerido');
    await http().post(`/usuarios/${con.id}/restablecer-mfa`).set(admin.auth).expect(201);
    await http().post('/auth/mfa/verificar').send({ mfa_token: l2.body.mfa_token, codigo: codigoSiguiente(con.secreto) }).expect(401);
  });

});
