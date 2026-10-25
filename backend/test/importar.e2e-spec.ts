import request from 'supertest';
import { crearApp, registrar } from './helpers';

describe('importar (carga masiva)', () => {
  let app, a, a2, org;
  beforeAll(async () => {
    app = await crearApp();
    a = await registrar(app, 'CENTRO_DIAGNOSTICO');
    a2 = await registrar(app, 'CENTRO_DIAGNOSTICO');
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());
  const pac = (n: number, extra = {}) => ({ nombreCompleto: `Paciente ${n}`, sexo: 'F', dpi: `100000000000${n}`, ...extra });
  const est = (dpi: string, extra = {}) => ({ dpi, tipoEstudio: 'Rayos X', fecha: '2026-10-13', ...extra });

  it('pacientes: importa y quedan en la entidad de quien importa', async () => {
    const r = await http().post('/pacientes/importar').set(a.auth).send({ filas: [pac(1), pac(2)] }).expect(201);
    expect(r.body.importados).toBe(2);
    expect((await http().get('/pacientes').set(a.auth)).body).toHaveLength(2);
    expect((await http().get('/pacientes').set(a2.auth)).body).toHaveLength(0);
  });

  it('pacientes: una fila inválida rechaza todo el archivo y dice qué fila es', async () => {
    const antes = (await http().get('/pacientes').set(a.auth)).body.length;
    const r = await http().post('/pacientes/importar').set(a.auth).send({ filas: [pac(3), pac(4, { sexo: 'X' }), pac(5)] }).expect(400);
    expect(r.body.errores).toHaveLength(1);
    expect(r.body.errores[0].fila).toBe(3); // fila 1 = encabezado, fila 2 = primer paciente, fila 3 = el inválido
    expect((await http().get('/pacientes').set(a.auth)).body).toHaveLength(antes);
  });

  it('rechaza archivo vacío, sin filas y demasiado grande', async () => {
    await http().post('/pacientes/importar').set(a.auth).send({ filas: [] }).expect(400);
    await http().post('/pacientes/importar').set(a.auth).send({}).expect(400);
    await http().post('/pacientes/importar').set(a.auth).send({ filas: Array.from({ length: 1001 }, (_, i) => pac(i)) }).expect(400);
  });

  it('estudios: enlaza el paciente por DPI e importa', async () => {
    const r = await http().post('/estudios/importar').set(a.auth).send({ filas: [est('1000000000001'), est('1000000000002', { hora: '10:30' })] }).expect(201);
    expect(r.body.importados).toBe(2);
    expect((await http().get('/estudios').set(a.auth)).body).toHaveLength(2);
  });

  it('estudios: DPI desconocido o de otra entidad -> 400 con la fila y no importa nada', async () => {
    const antes = (await http().get('/estudios').set(a.auth)).body.length;
    const r = await http().post('/estudios/importar').set(a.auth).send({ filas: [est('1000000000001'), est('9999999999999')] }).expect(400);
    expect(r.body.errores[0].fila).toBe(3);
    // el paciente existe, pero en la entidad a: la entidad a2 no puede usarlo
    await http().post('/estudios/importar').set(a2.auth).send({ filas: [est('1000000000001')] }).expect(400);
    expect((await http().get('/estudios').set(a.auth)).body).toHaveLength(antes);
  });

  it('estudios: 403 para organismo no lucrativo y 400 con datos inválidos', async () => {
    await http().post('/estudios/importar').set(org.auth).send({ filas: [est('1000000000001')] }).expect(403);
    await http().post('/estudios/importar').set(a.auth).send({ filas: [est('1000000000001', { fecha: 'ayer' })] }).expect(400);
  });

  it('sin token -> 401', async () => {
    await http().post('/pacientes/importar').send({ filas: [pac(9)] }).expect(401);
  });
});
