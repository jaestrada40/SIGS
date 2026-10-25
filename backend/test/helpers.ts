import { authenticator } from 'otplib';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule, configureApp } from '../src/app.module';

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
  const res = await request(app.getHttpServer()).post('/auth/registro').send({ nombre: 'E', tipo, correo, password: 'secreto1234', ...extra });
  // El registro ya no entrega sesión: hay que activar el MFA (como lo hace cualquier usuario) para obtener el token completo.
  const setup = { Authorization: `Bearer ${res.body.setup_token}` };
  const cfg = await request(app.getHttpServer()).post('/auth/mfa/configurar').set(setup);
  const act = await request(app.getHttpServer()).post('/auth/mfa/activar').set(setup).send({ codigo: authenticator.generate(cfg.body.secreto ?? 'AAAA') });
  if (!tokenDe(act)) throw new Error('registrar falló: ' + JSON.stringify({ reg: res.status + ' ' + JSON.stringify(res.body).slice(0,200), cfg: cfg.status + ' ' + JSON.stringify(cfg.body).slice(0,200), act: act.status + ' ' + JSON.stringify(act.body).slice(0,200) }));
  const token = tokenDe(act) as string;
  return { token, auth: { Authorization: `Bearer ${token}` }, correo, res, entidadId: act.body.entidad?.id as number, secreto: cfg.body.secreto as string, recuperacion: act.body.recuperacion as string[] };
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
