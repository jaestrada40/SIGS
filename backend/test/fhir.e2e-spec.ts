import request from 'supertest';
import { crearApp, crearUsuario, registrar } from './helpers';

describe('exportación FHIR (subconjunto)', () => {
  let app, centro, otro, org;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await crearApp();
    centro = await registrar(app, 'CENTRO_DIAGNOSTICO', { nombre: 'Centro Imagen' });
    otro = await registrar(app, 'CENTRO_DIAGNOSTICO');
    org = await registrar(app, 'ORG_NO_LUCRATIVA');
    const p = (await http().post('/pacientes').set(centro.auth).send({ nombreCompleto: 'Ana López', sexo: 'F', dpi: '2048173580301', fechaNacimiento: '1985-03-12', telefono: '55123456', departamento: 'Guatemala', municipio: 'Mixco' }).expect(201)).body;
    await http().post('/pacientes').set(centro.auth).send({ nombreCompleto: 'Beto Pérez', sexo: 'NE' }).expect(201);
    await http().post('/estudios').set(centro.auth).send({ pacienteId: p.id, tipoEstudio: 'Mamografía', fecha: '2026-10-01', hora: '09:30', estado: 'REALIZADO', resultado: 'Sin hallazgos' }).expect(201);
    await http().post('/estudios').set(centro.auth).send({ pacienteId: p.id, tipoEstudio: 'Ultrasonido', fecha: '2026-10-02', estado: 'PROGRAMADO' }).expect(201);
    await http().post('/pacientes').set(otro.auth).send({ nombreCompleto: 'Ajena', sexo: 'F' }).expect(201);
  });
  afterAll(() => app.close());

  it('Patient: Bundle FHIR con identificador, género, fecha, teléfono y dirección; omite lo vacío', async () => {
    const r = await http().get('/fhir/Patient').set(centro.auth).expect(200);
    expect(r.headers['content-type']).toMatch(/^application\/fhir\+json/);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ resourceType: 'Bundle', type: 'collection', total: 2 });
    const [ana, beto] = r.body.entry.map((e) => e.resource);
    expect(ana).toMatchObject({
      resourceType: 'Patient', gender: 'female', birthDate: '1985-03-12', name: [{ text: 'Ana López' }],
      identifier: [{ system: 'urn:gt:renap:cui', value: '2048173580301' }], telecom: [{ system: 'phone', value: '55123456' }],
      address: [{ country: 'GT', state: 'Guatemala', city: 'Mixco' }],
    });
    expect(beto.gender).toBe('unknown');
    expect(beto).not.toHaveProperty('identifier');
    expect(beto).not.toHaveProperty('birthDate');
    expect(JSON.stringify(r.body)).not.toContain('Ajena');   // solo los de su entidad
  });

  it('DiagnosticReport: solo estudios realizados, con el paciente referenciado y el resultado como conclusión', async () => {
    const r = await http().get('/fhir/DiagnosticReport').set(centro.auth).expect(200);
    expect(r.body.total).toBe(1);
    expect(r.body.entry[0].resource).toMatchObject({
      resourceType: 'DiagnosticReport', status: 'final', code: { text: 'Mamografía' }, subject: { reference: 'Patient/1' },
      effectiveDateTime: '2026-10-01T09:30', conclusion: 'Sin hallazgos', performer: [{ reference: `Organization/${centro.entidadId}` }],
    });
  });

  it('Organization: la propia entidad', async () => {
    const r = await http().get('/fhir/Organization').set(centro.auth).expect(200);
    expect(r.body.entry[0].resource).toMatchObject({ resourceType: 'Organization', name: 'Centro Imagen' });
  });

  it('un organismo exporta Patient y Organization, pero no DiagnosticReport (no tiene estudios)', async () => {
    await http().get('/fhir/Patient').set(org.auth).expect(200);
    await http().get('/fhir/Organization').set(org.auth).expect(200);
    await http().get('/fhir/DiagnosticReport').set(org.auth).expect(403);
  });

  it('solo administrador y auditor; operador y sin sesión no', async () => {
    const op = await crearUsuario(app, centro, 'OPERADOR');
    const aud = await crearUsuario(app, centro, 'AUDITOR');
    await http().get('/fhir/Patient').set(op.auth).expect(403);
    await http().get('/fhir/Patient').set(aud.auth).expect(200);
    await http().get('/fhir/Patient').expect(401);
  });

  it('cada descarga queda en la auditoría con el recurso y el número de filas, sin datos personales', async () => {
    const log = (await http().get('/bitacora').set(centro.auth)).body.filter((m) => m.tabla === 'fhir');
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(log[0]).toMatchObject({ accion: 'EXPORTAR' });
    expect(log.map((m) => m.detalle.recurso)).toEqual(expect.arrayContaining(['Patient', 'DiagnosticReport', 'Organization']));
    expect(JSON.stringify(log)).not.toMatch(/Ana|2048173580301/);
  });
});
