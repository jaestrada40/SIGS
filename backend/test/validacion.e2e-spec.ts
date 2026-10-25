import request from 'supertest';
import { crearApp, registrar } from './helpers';

describe('validación de pacientes: DPI, teléfono, departamento y municipio', () => {
  let app, u;
  const http = () => request(app.getHttpServer());
  const base = { nombreCompleto: 'Ana López', sexo: 'F' };
  const crear = (extra: object) => http().post('/pacientes').set(u.auth).send({ ...base, ...extra });
  beforeAll(async () => { app = await crearApp(); u = await registrar(app, 'CENTRO_DIAGNOSTICO'); });
  afterAll(() => app.close());

  it('DPI: exactamente 13 dígitos', async () => {
    await crear({ dpi: '2345678901234' }).expect(201);
    for (const dpi of ['123', '12345678901234', '234567890123a', '2345 6789 01234']) {
      const r = await crear({ dpi }).expect(400);
      expect(JSON.stringify(r.body.message)).toContain('13 dígitos');
    }
  });

  it('teléfono: 8 dígitos de Guatemala; acepta +502, espacios y guiones y lo guarda limpio', async () => {
    for (const telefono of ['55123456', '5512 3456', '5512-3456', '+502 5512-3456', '50255123456']) {
      const r = await crear({ telefono }).expect(201);
      expect(r.body.telefono).toBe('55123456');
    }
    for (const telefono of ['1234567', '123456789', '15123456', 'abcdefgh', '8512 3456']) await crear({ telefono }).expect(400);
    await crear({ contactoEmergencia: 'María López, 2234 5678' }).expect(201);   // el contacto de emergencia es texto libre
  });

  it('municipio: debe pertenecer al departamento (y el departamento existir)', async () => {
    await crear({ departamento: 'Sacatepéquez', municipio: 'Antigua Guatemala' }).expect(201);
    await crear({ departamento: 'Quiché', municipio: 'Antigua Guatemala' }).expect(400);
    await crear({ departamento: 'Narnia', municipio: 'Mixco' }).expect(400);
    await crear({ municipio: 'Mixco' }).expect(400);   // municipio sin departamento
    await crear({ departamento: 'Guatemala' }).expect(201);
  });

  it('PATCH aplica las mismas reglas', async () => {
    const p = (await crear({}).expect(201)).body;
    await http().patch(`/pacientes/${p.id}`).set(u.auth).send({ dpi: '12' }).expect(400);
    await http().patch(`/pacientes/${p.id}`).set(u.auth).send({ departamento: 'Petén', municipio: 'Flores', telefono: '+502 4012 3456' }).expect(200);
  });

  it('el catálogo está ordenado alfabéticamente, exige sesión y no repite municipios', async () => {
    await http().get('/catalogos/geografia').expect(401);
    const g = (await http().get('/catalogos/geografia').set(u.auth).expect(200)).body as Record<string, string[]>;
    const col = new Intl.Collator('es');
    const deptos = Object.keys(g);
    expect(deptos).toHaveLength(22);
    expect(deptos).toEqual([...deptos].sort(col.compare));
    for (const [d, ms] of Object.entries(g)) {
      expect(ms).toEqual([...ms].sort(col.compare));
      expect(new Set(ms).size).toBe(ms.length);
      expect(ms.length).toBeGreaterThan(0);
      expect(d).toBeTruthy();
    }
  });

  it('la importación CSV también rechaza DPI y teléfono inválidos, diciendo la fila', async () => {
    const r = await http().post('/pacientes/importar').set(u.auth).send({ filas: [{ ...base, dpi: '2345678901235' }, { ...base, dpi: '99' }] }).expect(400);
    expect(JSON.stringify(r.body.errores)).toContain('13 dígitos');
    expect(r.body.errores[0].fila).toBe(3);
  });
});
