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

  describe('consola del superadmin', () => {
    const idDe = async (correo: string) => (await app.get(DataSource).query('SELECT id FROM usuario WHERE correo = $1', [correo]))[0].id as number;

    it('suspender corta el acceso al instante y reactivar lo devuelve', async () => {
      const sa = await superadmin(app);
      const e = await registrar(app, 'CENTRO_DIAGNOSTICO');
      await http().get('/pacientes').set(e.auth).expect(200);
      await http().patch(`/plataforma/entidades/${e.entidadId}/estado`).set(sa.auth).send({ activa: false }).expect(200);
      await http().get('/pacientes').set(e.auth).expect(401);
      const l = await http().post('/auth/login').send({ correo: e.correo, password: 'secreto1234' });
      expect(l.status).toBe(403);
      expect(l.body.message).toMatch(/suspendida/);
      const lista = await http().get('/plataforma/entidades').set(sa.auth);
      expect(lista.body.find((x) => x.id === e.entidadId).estado).toBe('suspendida');
      await http().patch(`/plataforma/entidades/${e.entidadId}/estado`).set(sa.auth).send({ activa: true }).expect(200);
      expect((await http().post('/auth/login').send({ correo: e.correo, password: 'secreto1234' })).body.estado).toBe('mfa_requerido');
      await http().patch(`/plataforma/entidades/${e.entidadId}/estado`).set(sa.auth).send({ activa: 'x' }).expect(400);
    });

    it('lista usuarios de todas las entidades sin secretos; desactivar y reactivar; nunca a sí mismo', async () => {
      const sa = await superadmin(app);
      const e = await registrar(app, 'ORG_NO_LUCRATIVA');
      const lista = await http().get('/plataforma/usuarios').set(sa.auth).expect(200);
      expect(JSON.stringify(lista.body)).not.toMatch(/passwordHash|mfaSecreto|mfaRecuperacion|invitacionHash/);
      const fila = lista.body.find((u) => u.correo === e.correo);
      expect(fila).toMatchObject({ rol: 'ADMIN', entidadTipo: 'ORG_NO_LUCRATIVA', mfaActivo: true, activo: true });
      await http().patch(`/plataforma/usuarios/${fila.id}/activo`).set(sa.auth).send({ activo: false }).expect(200);
      await http().get('/pacientes').set(e.auth).expect(401);
      await http().patch(`/plataforma/usuarios/${fila.id}/activo`).set(sa.auth).send({ activo: true }).expect(200);
      await http().patch(`/plataforma/usuarios/${await idDe(sa.correo)}/activo`).set(sa.auth).send({ activo: false }).expect(403);
    });

    it('restablecer acceso: cierra sesiones, borra MFA y deja entrar solo con el enlace nuevo', async () => {
      const sa = await superadmin(app);
      const e = await registrar(app, 'CENTRO_DIAGNOSTICO');
      const id = await idDe(e.correo);
      const r = await http().post(`/plataforma/usuarios/${id}/restablecer-acceso`).set(sa.auth).expect(201);
      await http().get('/pacientes').set(e.auth).expect(401);
      await http().post('/auth/login').send({ correo: e.correo, password: 'secreto1234' }).expect(401);
      const a = await http().post(`/auth/invitacion/${r.body.invitacion}`).send({ password: 'ClaveNueva#2026' }).expect(201);
      expect(a.body.estado).toBe('mfa_configurar');
      await http().post(`/plataforma/usuarios/${await idDe(sa.correo)}/restablecer-acceso`).set(sa.auth).expect(403);
    });

    it('un superadmin puede invitar a otro, que entra a la consola', async () => {
      const sa = await superadmin(app);
      const c = await http().post('/plataforma/superadmins').set(sa.auth).send({ nombre: 'Segundo', correo: 'segundo@test.com' }).expect(201);
      await http().post('/plataforma/superadmins').set(sa.auth).send({ nombre: 'Otra vez', correo: 'segundo@test.com' }).expect(409);
      await http().post(`/auth/invitacion/${c.body.invitacion}`).send({ password: 'ClaveNueva#2026' }).expect(201);
      const s2 = await entrar(app, 'segundo@test.com', 'ClaveNueva#2026');
      await http().get('/plataforma/resumen').set(s2.auth).expect(200);
      const e = await registrar(app, 'CENTRO_DIAGNOSTICO');
      await http().post('/plataforma/superadmins').set(e.auth).send({ nombre: 'X', correo: 'x2@test.com' }).expect(403);
    });

    it('editar entidad y resumen con totales', async () => {
      const sa = await superadmin(app);
      const c = await nueva(sa, 'edit@test.com', { departamento: 'Petén' });
      const r = await http().patch(`/plataforma/entidades/${c.body.entidad.id}`).set(sa.auth).send({ nombre: 'Nombre Nuevo', telefono: '5555-1234' }).expect(200);
      expect(r.body).toMatchObject({ nombre: 'Nombre Nuevo', telefono: '5555-1234', departamento: 'Petén' });
      await http().patch(`/plataforma/entidades/${c.body.entidad.id}`).set(sa.auth).send({ nombre: '' }).expect(400);
      const res = await http().get('/plataforma/resumen').set(sa.auth).expect(200);
      expect(res.body.entidades.total).toBeGreaterThan(0);
      expect(res.body.entidades.pendientes).toBeGreaterThan(0);
      expect(res.body.usuarios).toHaveProperty('sinMfa');
      expect(res.body.seguridad).toHaveProperty('bloqueos7d');
    });

    it('la auditoría de plataforma trae eventos de cuentas, sin datos clínicos ni duplicados; la entidad ve lo que se hizo con sus cuentas', async () => {
      const sa = await superadmin(app);
      const e = await registrar(app, 'CENTRO_DIAGNOSTICO');
      await http().post('/pacientes').set(e.auth).send({ nombreCompleto: 'Ana López', sexo: 'F' }).expect(201);
      const id = await idDe(e.correo);
      await http().patch(`/plataforma/usuarios/${id}/activo`).set(sa.auth).send({ activo: false }).expect(200);
      await http().patch(`/plataforma/usuarios/${id}/activo`).set(sa.auth).send({ activo: true }).expect(200);
      const aud = await http().get('/plataforma/auditoria').set(sa.auth).expect(200);
      expect(aud.body.some((m) => m.tabla === 'paciente' && m.accion === 'CREAR')).toBe(false);
      expect(JSON.stringify(aud.body)).not.toContain('Ana');
      const desact = aud.body.filter((m) => m.accion === 'DESACTIVAR' && m.registroId === id);
      expect(desact).toHaveLength(1);
      expect(desact[0].usuario.rol).toBe('SUPERADMIN');
      expect(desact[0].objetivo).toContain(e.correo);
      // la copia que ve la entidad en su propia auditoría: sin nombre de persona, marcada como hecha por la plataforma
      const filas = await app.get(DataSource).query(`SELECT * FROM bitacora WHERE "entidadId" = $1`, [e.entidadId]);
      expect(filas.some((m) => m.accion === 'DESACTIVAR' && m.detalle?.plataforma === true && m.usuarioId == null)).toBe(true);
    });
  });
});

