// Datos de ejemplo para presentar la app: un centro de diagnóstico y una organización, con usuarios, pacientes,
// estudios, campañas y referidos. Uso (desde backend/, con la API ya arrancada una vez para que exista el esquema):
//   node db/demo.mjs
// En un contenedor sin .env (Coolify) toma DB_HOST, DB_PORT, DB_USER, DB_PASS y DB_NAME del entorno.
// No hace nada si los datos ya existen. Todos los usuarios usan la contraseña PASSWORD; el MFA se configura en el primer ingreso.
import fs from 'node:fs';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const PASSWORD = 'Demo#2026sisg';
const env = !fs.existsSync(new URL('../.env', import.meta.url)) ? process.env : Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME, timezone: 'Z' });

if ((await db.query("SELECT 1 FROM entidad WHERE correo = 'centro@demo.sisg'"))[0].length) { console.log('Los datos de ejemplo ya existen.'); process.exit(0); }

let semilla = 7;
const azar = (n) => { semilla = (semilla * 16807) % 2147483647; return semilla % n; };
const elegir = (a) => a[azar(a.length)];
const dia = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const hash = await bcrypt.hash(PASSWORD, 10);

const insertar = async (tabla, fila) => (await db.query(`INSERT INTO ${tabla} SET ?`, [fila]))[0].insertId;
const entidad = (nombre, tipo, departamento, correo) => insertar('entidad', { nombre, tipo, departamento, correo, telefono: '22345678', activa: 1 });
const usuario = (entidadId, nombre, correo, rol) => insertar('usuario', { entidadId, nombre, correo, rol, passwordHash: hash, activo: 1, mfaActivo: 0 });

const centro = await entidad('Centro Diagnóstico Vida', 'CENTRO_DIAGNOSTICO', 'Guatemala', 'centro@demo.sisg');
const org = await entidad('Fundación Luz y Salud', 'ORG_NO_LUCRATIVA', 'Escuintla', 'org@demo.sisg');
for (const [e, p] of [[centro, 'centro'], [org, 'org']]) {
  await usuario(e, `Administrador ${p}`, `${p}@demo.sisg`, 'ADMIN');
  await usuario(e, `Operador ${p}`, `operador.${p}@demo.sisg`, 'OPERADOR');
  await usuario(e, `Auditor ${p}`, `auditor.${p}@demo.sisg`, 'AUDITOR');
}

const nombres = ['Ana', 'María', 'Luisa', 'Carmen', 'Rosa', 'Elena', 'José', 'Carlos', 'Luis', 'Pedro', 'Juan', 'Miguel'];
const apellidos = ['López', 'García', 'Pérez', 'Morales', 'Hernández', 'Ramírez', 'Cruz', 'Castillo', 'Mejía', 'Barrios'];
const lugares = [['Guatemala', 'Guatemala'], ['Guatemala', 'Mixco'], ['Escuintla', 'Escuintla'], ['Sacatepéquez', 'Antigua Guatemala'], ['Quetzaltenango', 'Quetzaltenango'], ['Alta Verapaz', 'Cobán']];
const tipos = [['Mamografía', 450], ['Ultrasonido abdominal', 300], ['Rayos X de tórax', 200], ['Papanicolaou', 150], ['Electrocardiograma', 180], ['Espirometría', 250]];

const paciente = (entidadId, i) => {
  const [departamento, municipio] = elegir(lugares);
  return insertar('paciente', { entidadId, nombreCompleto: `${elegir(nombres)} ${elegir(apellidos)} ${elegir(apellidos)}`, dpi: String(2000000000000 + entidadId * 100000 + i).padStart(13, '0'),
    fechaNacimiento: `${1950 + azar(55)}-${String(1 + azar(12)).padStart(2, '0')}-${String(1 + azar(28)).padStart(2, '0')}`, sexo: elegir(['F', 'F', 'M']), departamento, municipio, telefono: `5${String(1000000 + azar(8999999))}`, estado: 'ACTIVO' });
};

// Centro: 40 pacientes y ~90 estudios en los últimos seis meses (algunos programados, uno vencido y uno sin monto para activar alertas).
const pacientesCentro = [];
for (let i = 0; i < 40; i++) pacientesCentro.push(await paciente(centro, i));
for (let i = 0; i < 90; i++) {
  const [tipoEstudio, precio] = elegir(tipos), futuro = i % 9 === 0, estado = futuro ? 'PROGRAMADO' : i % 11 === 0 ? 'CANCELADO' : 'REALIZADO';
  await insertar('estudio', { entidadId: centro, pacienteId: elegir(pacientesCentro), tipoEstudio, salaEquipo: `Sala ${1 + azar(3)}`, fecha: futuro ? dia(1 + azar(20)) : dia(-azar(170)), hora: `${8 + azar(9)}:00:00`,
    especialista: elegir(['Dra. Méndez', 'Dr. Ortiz', 'Dra. Solís']), estado, resultado: estado === 'REALIZADO' && i % 13 !== 0 ? 'Sin hallazgos de importancia' : null, monto: estado === 'REALIZADO' && i % 17 !== 0 ? precio : null });
}
await insertar('estudio', { entidadId: centro, pacienteId: pacientesCentro[0], tipoEstudio: 'Ultrasonido abdominal', fecha: dia(-12), estado: 'PROGRAMADO' });   // programado y ya vencido

// Organización: 25 pacientes, 6 campañas y referidos hacia el centro.
for (let i = 0; i < 25; i++) await paciente(org, i);
const campanas = [];
const defs = [['Jornada de salud cardiovascular', 'CARDIOVASCULAR', 'Escuintla', 'FINALIZADA', -150, -140, 180, 8200], ['Tamizaje respiratorio escolar', 'RESPIRATORIA', 'Sacatepéquez', 'FINALIZADA', -110, -100, 120, 5400],
  ['Prevención de cáncer cervicouterino', 'ONCOLOGICO_OTRO', 'Guatemala', 'FINALIZADA', -70, -60, 210, 9800], ['Planificación familiar rural', 'PLANIFICACION', 'Alta Verapaz', 'EN_CURSO', -20, 10, 90, 4300],
  ['Mamografías comunitarias', 'ONCOLOGICO_OTRO', 'Quetzaltenango', 'EN_CURSO', -35, -3, 60, null], ['Chequeo cardiovascular 2027', 'CARDIOVASCULAR', 'Guatemala', 'PROGRAMADA', 20, 30, 0, null]];
for (const [nombre, area, departamento, estado, ini, fin, personasAtendidas, costo] of defs)
  campanas.push(await insertar('campana', { entidadId: org, nombre, area, departamento, ubicacion: `Salón comunal, ${departamento}`, fechaInicio: dia(ini), fechaFin: dia(fin), personasAtendidas, estado, costo }));

const estadosRef = ['PENDIENTE', 'AGENDADO', 'ATENDIDO', 'ATENDIDO', 'ATENDIDO', 'NO_LLEGO'];
for (let i = 0; i < 18; i++) {
  const estado = estadosRef[i % 6], [tipoEstudio] = elegir(tipos);
  await insertar('referido', { entidadOrigenId: org, entidadDestinoId: centro, campanaId: elegir(campanas.slice(0, 5)), nombreCompleto: `${elegir(nombres)} ${elegir(apellidos)} ${elegir(apellidos)}`, sexo: 'F', telefono: `5${String(1000000 + azar(8999999))}`,
    tipoEstudio, motivo: 'Hallazgo en jornada comunitaria', estado, codigo: `DEMO${String(i).padStart(4, '0')}`, consentimientoEn: new Date(Date.now() - (30 - i) * 86_400_000), fechaCita: estado === 'AGENDADO' ? dia(3 + i) : null });
}

console.log(`Listo. Usuarios (contraseña ${PASSWORD}): centro@demo.sisg, operador.centro@demo.sisg, auditor.centro@demo.sisg, org@demo.sisg, operador.org@demo.sisg, auditor.org@demo.sisg`);
await db.end();
