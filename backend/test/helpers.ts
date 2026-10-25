import { authenticator } from 'otplib';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule, configureApp } from '../src/app.module';
import { Rol, TipoEntidad } from '../src/common/enums';
import { Entidad } from '../src/entidades/entidad.entity';
import { Usuario } from '../src/usuarios/usuario.entity';

export async function crearApp() {
  process.env.DB_NAME = 'sisg_test';
  // NestFactory (not Test module): serve-static needs the http adapter present when the module is built
  const app: INestApplication = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  // clean slate per spec file
  await app.get(DataSource).query('TRUNCATE entidad, usuario, paciente, estudio, campana, bitacora, referido, enlace_resultado, atencion RESTART IDENTITY');
  return app;
}

let n = 0;
export async function registrar(app: INestApplication, tipo: string, extra = {}) {
  const correo = `u${Date.now()}${n++}@test.com`;
  // Ya no hay registro público: la entidad y su administrador se crean directamente en la base.
  const db = app.get(DataSource);
  const e = await db.getRepository(Entidad).save(db.getRepository(Entidad).create({ nombre: 'E', tipo: tipo as TipoEntidad, correo, ...extra }));
  await db.getRepository(Usuario).save(db.getRepository(Usuario).create({ entidadId: e.id, nombre: 'Administrador', correo, rol: Rol.ADMIN, passwordHash: await bcrypt.hash('secreto1234', 4) }));
  // Sin sesión directa: hay que activar el MFA (como lo hace cualquier usuario) para obtener el token completo.
  const s = await entrar(app, correo, 'secreto1234');
  if (!s.token) throw new Error('registrar falló: ' + s.res.status + ' ' + JSON.stringify(s.res.body).slice(0, 200));
  return { token: s.token, auth: s.auth, correo, res: s.res, entidadId: e.id, secreto: s.secreto, recuperacion: s.res.body.recuperacion as string[] };
}

// Crea el superadmin directamente en la base (en producción lo hace SuperadminInicial) y abre su sesión.
export async function superadmin(app: INestApplication) {
  const db = app.get(DataSource);
  const correo = `super${Date.now()}${n++}@test.com`;
  const e = await db.getRepository(Entidad).save(db.getRepository(Entidad).create({ nombre: 'SISG Plataforma', tipo: TipoEntidad.PLATAFORMA, correo }));
  await db.getRepository(Usuario).save(db.getRepository(Usuario).create({ entidadId: e.id, nombre: 'Superadministrador', correo, rol: Rol.SUPERADMIN, passwordHash: await bcrypt.hash('secreto1234', 4) }));
  return { ...(await entrar(app, correo, 'secreto1234')), correo };
}

// Código del siguiente intervalo de 30 s: el actual ya se consumió al activar el MFA y no puede repetirse.
export const codigoSiguiente = (secreto: string) => authenticator.clone({ epoch: Date.now() + 30_000 }).generate(secreto);

// Inicia sesión completa como un usuario ya creado (configura el MFA si es su primer acceso).
export async function entrar(app: INestApplication, correo: string, password: string) {
  const http = () => request(app.getHttpServer());
  const l = await http().post('/auth/login').send({ correo, password });
  if (l.body.estado === 'mfa_configurar') {
    const setup = { Authorization: `Bearer ${l.body.setup_token}` };
    const cfg = await http().post('/auth/mfa/configurar').set(setup);
    const act = await http().post('/auth/mfa/activar').set(setup).send({ codigo: authenticator.generate(cfg.body.secreto) });
    return { token: tokenDe(act) as string, auth: { Authorization: `Bearer ${tokenDe(act)}` }, secreto: cfg.body.secreto as string, res: act };
  }
  return { token: undefined as unknown as string, auth: {}, secreto: '', res: l };
}

// Crea un usuario de la misma entidad que `admin` y deja su sesión abierta.
export async function crearUsuario(app: INestApplication, admin: { auth: object }, rol: 'ADMIN' | 'OPERADOR' | 'AUDITOR') {
  const correo = `${rol.toLowerCase()}${Date.now()}${n++}@test.com`;
  const res = await request(app.getHttpServer()).post('/usuarios').set(admin.auth as Record<string, string>).send({ nombre: `Usuario ${rol}`, correo, rol, password: 'ClaveInicial#2026' });
  const s = await entrar(app, correo, 'ClaveInicial#2026');
  return { ...s, id: res.body.id as number, correo, res };
}

/** Desde que la sesión viaja en una cookie HttpOnly, el token ya no va en el cuerpo: se toma de la cabecera Set-Cookie (la API también lo acepta como Bearer). */
export function tokenDe(res: { headers: Record<string, unknown> }): string | undefined {
  const c = ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []).find((x) => x.startsWith('sisg_session='));
  return c?.split(';')[0]?.slice('sisg_session='.length);
}
