import request from 'supertest';
import { crearApp, registrar } from './helpers';

describe('bitacora', () => {
  let app, a, a2, org;
  beforeAll(async () => {
    app = await crearApp();
    a = await registrar(app, 'CENTRO_DIAGNOSTICO');
    a2 = await registrar(app, 'CENTRO_DIAGNOSTICO');
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());
  // La bitácora también guarda eventos de seguridad (sesión, usuarios); estas pruebas miran solo los movimientos de datos.
  const datos = (r: { body: any[] }) => r.body.filter((x) => !['sesion', 'usuario'].includes(x.tabla));

  it('registra crear, modificar e importar, y la más reciente va primero', async () => {
    const p = (await http().post('/pacientes').set(a.auth).send({ nombreCompleto: 'Ana', sexo: 'F', dpi: '1110000000000' }).expect(201)).body;
    await http().patch(`/pacientes/${p.id}`).set(a.auth).send({ telefono: '55550000' }).expect(200);
    const e = (await http().post('/estudios').set(a.auth).send({ pacienteId: p.id, tipoEstudio: 'Rayos X', fecha: '2026-10-13' }).expect(201)).body;
    await http().patch(`/estudios/${e.id}`).set(a.auth).send({ resultado: 'Informacion clinica muy sensible' }).expect(200);
    await http().post('/pacientes/importar').set(a.auth).send({ filas: [{ nombreCompleto: 'Luis', sexo: 'M' }] }).expect(201);
    const log = datos(await http().get('/bitacora').set(a.auth).expect(200));
    expect(log.map((x) => `${x.tabla}:${x.accion}`)).toEqual(['paciente:IMPORTAR', 'estudio:MODIFICAR', 'estudio:CREAR', 'paciente:MODIFICAR', 'paciente:CREAR']);
    expect(log[1].detalle).toEqual({ campos: ['resultado'] });
  });

  it('nunca guarda los valores modificados (datos de salud)', async () => {
    const texto = JSON.stringify((await http().get('/bitacora').set(a.auth)).body);
    expect(texto).not.toContain('sensible');
    expect(texto).not.toContain('55550000');
  });

  it('cada entidad ve solo su propia actividad; los intentos fallidos no se registran', async () => {
    expect(datos(await http().get('/bitacora').set(a2.auth))).toHaveLength(0);
    await http().post('/estudios').set(a2.auth).send({ pacienteId: 1, tipoEstudio: 'X', fecha: '2026-10-13' }).expect(404);
    await http().post('/estudios').set(a.auth).send({ tipoEstudio: 'X', fecha: 'ayer' }).expect(400);
    expect(datos(await http().get('/bitacora').set(a2.auth))).toHaveLength(0);
    expect(datos(await http().get('/bitacora').set(a.auth))).toHaveLength(5);
  });

  it('la bitácora es solo lectura y exige sesión', async () => {
    await http().get('/bitacora').expect(401);
    await http().post('/bitacora').set(a.auth).send({}).expect(404);
    await http().delete('/bitacora/1').set(a.auth).expect(404);
    const c = (await http().post('/campanas').set(org.auth).send({ nombre: 'J', area: 'CARDIOVASCULAR', fechaInicio: '2026-10-01' }).expect(201)).body;
    await http().patch(`/campanas/${c.id}`).set(org.auth).send({ personasAtendidas: 5 }).expect(200);
    expect(datos(await http().get('/bitacora').set(org.auth)).map((x) => x.accion)).toEqual(['MODIFICAR', 'CREAR']);
  });
});
