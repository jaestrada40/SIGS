import request from 'supertest';
import { DataSource } from 'typeorm';
import { crearApp, crearUsuario, registrar } from './helpers';

const ayer = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

describe('enlace seguro de resultado y alertas', () => {
  let app, centro, otro, org, est, paciente;
  const http = () => request(app.getHttpServer());
  const ver = (token, verificacion) => http().post('/publico/resultado').send({ token, verificacion });
  const nuevoEnlace = async (dias?) => (await http().post('/enlaces').set(centro.auth).send({ estudioId: est.id, ...(dias ? { dias } : {}) }).expect(201)).body;

  beforeAll(async () => {
    app = await crearApp();
    centro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    otro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
    paciente = (await http().post('/pacientes').set(centro.auth).send({ nombreCompleto: 'Ana López', sexo: 'F', dpi: '2048173580301', fechaNacimiento: '1985-03-12' }).expect(201)).body;
    est = (await http().post('/estudios').set(centro.auth).send({ pacienteId: paciente.id, tipoEstudio: 'Mamografía', fecha: ayer, estado: 'REALIZADO', resultado: 'Sin hallazgos de importancia' }).expect(201)).body;
  });
  afterAll(() => app.close());

  it('solo se crea para un estudio propio, realizado y con resultado; y solo un centro', async () => {
    const programado = (await http().post('/estudios').set(centro.auth).send({ pacienteId: paciente.id, tipoEstudio: 'X', fecha: ayer, estado: 'PROGRAMADO' }).expect(201)).body;
    await http().post('/enlaces').set(centro.auth).send({ estudioId: programado.id }).expect(409);
    await http().post('/enlaces').set(otro.auth).send({ estudioId: est.id }).expect(404);
    await http().post('/enlaces').set(org.auth).send({ estudioId: est.id }).expect(403);
    await http().post('/enlaces').set(centro.auth).send({ estudioId: est.id, dias: 99 }).expect(400);
    const aud = await crearUsuario(app, centro, 'AUDITOR');
    await http().post('/enlaces').set(aud.auth).send({ estudioId: est.id }).expect(403);
  });

  it('con el token y la fecha de nacimiento (o últimos 4 del DPI) se ve el resultado, con cabeceras que impiden guardarlo', async () => {
    const { token } = await nuevoEnlace();
    const r = await ver(token, '1985-03-12').expect(200);
    expect(r.body).toMatchObject({ paciente: 'Ana López', tipoEstudio: 'Mamografía', resultado: 'Sin hallazgos de importancia' });
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toMatch(/noindex/);
    await ver(token, '0301').expect(200);
    expect(JSON.stringify(r.body)).not.toMatch(/2048173580301|entidadId|pacienteId/);   // no devuelve identificadores ni el DPI completo
  });

  it('en la base solo existe el hash del token', async () => {
    const { token } = await nuevoEnlace();
    const filas = await app.get(DataSource).query('SELECT "tokenHash" FROM enlace_resultado');
    expect(JSON.stringify(filas)).not.toContain(token);
    expect(filas.every((f) => /^[0-9a-f]{64}$/.test(f.tokenHash))).toBe(true);
  });

  it('un dato incorrecto no entrega nada y el enlace se bloquea tras 5 fallos', async () => {
    const { token } = await nuevoEnlace();
    for (let i = 0; i < 4; i++) { const r = await ver(token, '1990-01-01').expect(401); expect(JSON.stringify(r.body)).not.toMatch(/Sin hallazgos/); }
    await ver(token, '1990-01-01').expect(401);
    await ver(token, '1985-03-12').expect(404);   // ya bloqueado: ni siquiera con el dato correcto
  });

  it('token inventado, vencido o revocado dan el mismo error genérico', async () => {
    const inventado = await ver('x'.repeat(32), '1985-03-12').expect(404);
    const l = await nuevoEnlace();
    await app.get(DataSource).query(`UPDATE enlace_resultado SET "expiraEn" = now() - interval '1 minute' WHERE id = $1`, [l.id]);
    const vencido = await ver(l.token, '1985-03-12').expect(404);
    const r = await nuevoEnlace();
    await http().post(`/enlaces/${r.id}/revocar`).set(centro.auth).expect(201);
    const revocado = await ver(r.token, '1985-03-12').expect(404);
    expect(vencido.body.message).toBe(inventado.body.message);
    expect(revocado.body.message).toBe(inventado.body.message);
    await http().post(`/enlaces/${r.id}/revocar`).set(otro.auth).expect(404);   // otro centro no puede revocar el ajeno
  });

  it('el resultado dejó de ser visible si el estudio vuelve a no estar realizado', async () => {
    const { token } = await nuevoEnlace();
    await http().patch(`/estudios/${est.id}`).set(centro.auth).send({ estado: 'PROGRAMADO' }).expect(200);
    await ver(token, '1985-03-12').expect(404);
    await http().patch(`/estudios/${est.id}`).set(centro.auth).send({ estado: 'REALIZADO' }).expect(200);
  });

  it('el centro ve los accesos y todo queda en su auditoría sin datos personales', async () => {
    const { id, token } = await nuevoEnlace();
    await ver(token, '1990-01-01').expect(401); await ver(token, '1985-03-12').expect(200);
    const lista = (await http().get(`/enlaces?estudioId=${est.id}`).set(centro.auth).expect(200)).body;
    expect(lista.find((x) => x.id === id)).toMatchObject({ accesos: 1, intentosFallidos: 0 });
    expect(JSON.stringify(lista)).not.toMatch(/tokenHash|token"/);
    const log = (await http().get('/bitacora').set(centro.auth)).body.filter((m) => m.tabla === 'enlace' && m.registroId === id).map((m) => m.accion);
    expect(log).toEqual(expect.arrayContaining(['CREAR', 'ACCESO_FALLIDO', 'ACCESO']));
    expect(JSON.stringify((await http().get('/bitacora').set(centro.auth)).body)).not.toMatch(/Ana|1985-03-12|Sin hallazgos/);
  });

  it('alertas del centro: estudios vencidos, sin resultado y sin monto; desaparecen al corregirse', async () => {
    const c = await registrar(app, 'CENTRO_DIAGNOSTICO');
    const p = (await http().post('/pacientes').set(c.auth).send({ nombreCompleto: 'Beto', sexo: 'M' }).expect(201)).body;
    expect((await http().get('/alertas').set(c.auth).expect(200)).body).toEqual([]);
    const vencido = (await http().post('/estudios').set(c.auth).send({ pacienteId: p.id, tipoEstudio: 'X', fecha: ayer, estado: 'PROGRAMADO' }).expect(201)).body;
    await http().post('/estudios').set(c.auth).send({ pacienteId: p.id, tipoEstudio: 'Y', fecha: ayer, estado: 'REALIZADO' }).expect(201);
    const a = (await http().get('/alertas').set(c.auth)).body;
    expect(a.map((x) => x.clave).sort()).toEqual(['estudios_vencidos', 'sin_monto', 'sin_resultado']);
    expect(a.find((x) => x.clave === 'estudios_vencidos')).toMatchObject({ cantidad: 1, nivel: 'alta', ruta: '/estudios' });
    await http().patch(`/estudios/${vencido.id}`).set(c.auth).send({ estado: 'CANCELADO' }).expect(200);
    expect((await http().get('/alertas').set(c.auth)).body.map((x) => x.clave)).not.toContain('estudios_vencidos');
  });

  it('alertas del organismo: referidos sin atender, campañas vencidas y sin costo; sin sesión no hay acceso', async () => {
    const o = await registrar(app, 'ORG_NO_LUCRATIVA');
    await http().post('/campanas').set(o.auth).send({ nombre: 'Vieja', area: 'CARDIOVASCULAR', fechaInicio: '2020-01-01', fechaFin: '2020-02-01', estado: 'EN_CURSO' }).expect(201);
    const p = (await http().post('/pacientes').set(o.auth).send({ nombreCompleto: 'Cami', sexo: 'F' }).expect(201)).body;
    const r = (await http().post('/referidos').set(o.auth).send({ pacienteId: p.id, centroId: centro.entidadId, tipoEstudio: 'Z', consentimiento: true }).expect(201)).body;
    await app.get(DataSource).query(`UPDATE referido SET "creadoEn" = now() - interval '20 days' WHERE id = $1`, [r.id]);
    const claves = (await http().get('/alertas').set(o.auth).expect(200)).body.map((x) => x.clave);
    expect(claves).toEqual(expect.arrayContaining(['referidos_sin_atender', 'campanas_vencidas', 'campanas_sin_costo']));
    await http().get('/alertas').expect(401);
  });
});
