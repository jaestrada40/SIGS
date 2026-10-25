import { Body, ConflictException, Controller, Headers, HttpException, Injectable, Ip, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { Public } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { cifrar, codigoRecuperacion, descifrar, normalizarRecuperacion, sha256 } from '../common/cripto';
import { Rol } from '../common/enums';
import { Entidad } from '../entidades/entidad.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { CambiarPasswordDto, CodigoDto, LoginDto, MfaVerificarDto, RegistroDto } from './auth.dto';

const ISSUER = 'sisg';
authenticator.options = { window: 1 };   // tolera ±30 s de desfase de reloj
// Paso de tiempo (30 s) al que corresponde un código válido, o null si no lo es.
const pasoValido = (secreto: string, codigo: string) => {
  const d = authenticator.checkDelta(codigo, secreto);
  return d === null ? null : Math.floor(Date.now() / 30_000) + d;
};
const MAX_INTENTOS = 5;          // por IP + cuenta: un atacante solo se bloquea a sí mismo
const MAX_INTENTOS_CUENTA = 25;  // tope global por cuenta contra ataques repartidos entre muchas IP
const BLOQUEO_MS = 15 * 60_000;
const COSTO_BCRYPT = 12;
// Hash de relleno: si el correo no existe se compara igual, para que la respuesta no revele si la cuenta existe por el tiempo que tarda.
const RELLENO = bcrypt.hashSync('relleno-sin-uso', COSTO_BCRYPT);
// shortcut: contador en memoria (se pierde al reiniciar y no se comparte entre instancias); con varias instancias, moverlo a Redis.
const fallos = new Map<string, { n: number; hasta: number }>();
const bloqueado = (k: string) => { if ((fallos.get(k)?.hasta ?? 0) > Date.now()) throw new HttpException('Demasiados intentos fallidos. Intente de nuevo en unos minutos.', 429); };
function contarFallo(k: string): boolean {
  if (fallos.size > 10_000) for (const [c, r] of fallos) if (r.hasta < Date.now() && r.n === 0) fallos.delete(c);
  const r = fallos.get(k) ?? { n: 0, hasta: 0 };
  r.n++;
  const bloquea = r.n >= MAX_INTENTOS;
  if (bloquea) { r.n = 0; r.hasta = Date.now() + BLOQUEO_MS; }
  fallos.set(k, r);
  return bloquea;
}
const SEG = { id: true, entidadId: true, nombre: true, correo: true, rol: true, activo: true, passwordHash: true, mfaActivo: true, mfaSecreto: true, mfaUltimoPaso: true, mfaRecuperacion: true, intentosFallidos: true, bloqueadoHasta: true, sesionesDesde: true } as const;

// Solo los tokens con scope "full" abren la API; los de "mfa" y "mfa-setup" son parciales y solo sirven en /auth/mfa/*.
// El rol se lee de la base en cada petición: un cambio de rol o una desactivación surten efecto de inmediato.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, @InjectRepository(Usuario) private repo: Repository<Usuario>) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: cfg.getOrThrow('JWT_SECRET'), algorithms: ['HS256'], issuer: ISSUER });
  }
  async validate(p: { sub: number; tipo: string; scope?: string; ms?: number }) {
    if (p.scope !== 'full') throw new UnauthorizedException();
    const u = await this.repo.findOne({ where: { id: p.sub }, select: { id: true, entidadId: true, rol: true, activo: true, sesionesDesde: true } });
    // Cerrar sesión (o cambiar credenciales, rol o estado) invalida los tokens emitidos antes de ese momento.
    if (!u || !u.activo || (u.sesionesDesde && (p.ms ?? 0) <= u.sesionesDesde.getTime())) throw new UnauthorizedException();
    return { entidadId: u.entidadId, tipo: p.tipo, usuarioId: u.id, rol: u.rol };
  }
}

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    @InjectRepository(Usuario) private repo: Repository<Usuario>,
    @InjectRepository(Entidad) private entidades: Repository<Entidad>,
    @InjectRepository(Bitacora) private bit: Repository<Bitacora>,
    private jwt: JwtService, private db: DataSource,
  ) {}

  private evento(u: Usuario, accion: string, detalle: Record<string, unknown> | null = null) {
    return registrar(this.bit, { entidadId: u.entidadId, usuarioId: u.id }, 'sesion', u.id, accion, detalle);
  }
  private async sesion(u: Usuario) {
    const e = await this.entidades.findOneByOrFail({ id: u.entidadId });
    const access_token = await this.jwt.signAsync({ sub: u.id, tipo: e.tipo, scope: 'full', ms: Date.now() });
    return { access_token, entidad: { id: e.id, nombre: e.nombre, tipo: e.tipo }, usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol } };
  }
  private async iniciar(u: Usuario) {
    await this.repo.update(u.id, { ultimoAcceso: new Date() });
    await this.evento(u, 'INICIO_SESION');
    return this.sesion(u);
  }
  private temporal(u: Usuario, scope: 'mfa' | 'mfa-setup') {
    return this.jwt.signAsync({ sub: u.id, scope }, { expiresIn: scope === 'mfa' ? '5m' : '15m' });
  }
  // Tras la contraseña nadie recibe sesión completa: o ya tiene MFA (pide el código) o debe configurarlo.
  private async siguientePaso(u: Usuario) {
    return u.mfaActivo ? { estado: 'mfa_requerido', mfa_token: await this.temporal(u, 'mfa') } : { estado: 'mfa_configurar', setup_token: await this.temporal(u, 'mfa-setup') };
  }
  private async deToken(token: string | undefined, scope: string): Promise<Usuario> {
    try {
      const p = await this.jwt.verifyAsync(token ?? '', { algorithms: ['HS256'], issuer: ISSUER });
      if (p.scope !== scope) throw new Error('scope');
      const u = await this.repo.findOne({ where: { id: p.sub }, select: SEG });
      if (!u || !u.activo) throw new Error('sin usuario');
      return u;
    } catch { throw new UnauthorizedException(); }
  }
  private deBearer(h?: string) { return /^Bearer (.+)$/.exec(h ?? '')?.[1]; }
  private verBloqueo(u: Usuario) {
    if (u.bloqueadoHasta && u.bloqueadoHasta > new Date()) throw new HttpException('Demasiados intentos fallidos. Intente de nuevo en unos minutos.', 429);
  }
  private async fallo(u: Usuario, k: string): Promise<never> {
    // Solo se audita el bloqueo (no cada intento): así un atacante no puede llenar la bitácora de ruido.
    if (contarFallo(k)) await this.evento(u, 'BLOQUEO', { minutos: BLOQUEO_MS / 60_000 });
    // Incremento atómico en SQL: las peticiones en paralelo no pueden saltarse el tope.
    await this.repo.query(
      `UPDATE usuario SET "intentosFallidos" = CASE WHEN "intentosFallidos" + 1 >= $2 THEN 0 ELSE "intentosFallidos" + 1 END,
         "bloqueadoHasta" = CASE WHEN "intentosFallidos" + 1 >= $2 THEN now() + ($3 || ' milliseconds')::interval ELSE "bloqueadoHasta" END WHERE id = $1`,
      [u.id, MAX_INTENTOS_CUENTA, BLOQUEO_MS]);
    throw new UnauthorizedException();
  }
  private async limpiar(u: Usuario, k: string) { fallos.delete(k); await this.repo.update(u.id, { intentosFallidos: 0, bloqueadoHasta: null }); }

  // Crea la entidad y su primer usuario administrador en una sola transacción.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('registro')
  async registro(@Body() { password, correo, nombre, ...resto }: RegistroDto) {
    if (await this.repo.findOneBy({ correo }) || await this.entidades.findOneBy({ correo })) throw new ConflictException('correo ya registrado');
    const u = await this.db.transaction(async (m) => {
      const e = await m.save(m.create(Entidad, { ...resto, nombre, correo }));
      return m.save(m.create(Usuario, { entidadId: e.id, nombre: 'Administrador', correo, rol: Rol.ADMIN, passwordHash: await bcrypt.hash(password, COSTO_BCRYPT) }));
    });
    await registrar(this.bit, { entidadId: u.entidadId, usuarioId: u.id }, 'usuario', u.id, 'CREAR', { campos: ['entidad', 'administrador'] });
    return this.siguientePaso(u);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() { correo, password }: LoginDto, @Ip() ip: string) {
    const k = `login|${ip}|${correo.toLowerCase()}`;
    bloqueado(k);   // antes de buscar la cuenta: el 429 es igual exista o no el correo
    const u = await this.repo.findOne({ where: { correo }, select: SEG });
    const ok = await bcrypt.compare(password, u?.passwordHash ?? RELLENO);
    if (!u || !ok || !u.activo) { if (u) return this.fallo(u, k); contarFallo(k); throw new UnauthorizedException(); }
    this.verBloqueo(u);
    await this.limpiar(u, k);
    return this.siguientePaso(u);
  }

  // Paso 2 del inicio de sesión: código de la app autenticadora o un código de recuperación (de un solo uso).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/verificar')
  async verificar(@Body() { mfa_token, codigo }: MfaVerificarDto, @Ip() ip: string) {
    const u = await this.deToken(mfa_token, 'mfa');
    const k = `mfa|${ip}|${u.id}`;
    bloqueado(k);
    this.verBloqueo(u);
    const c = codigo.trim();
    let ok = false;
    if (/^\d{3}\s?\d{3}$/.test(c)) ok = await this.consumirTotp(u, c.replace(/\s/g, ''));
    else ok = await this.consumirRecuperacion(u, sha256(normalizarRecuperacion(c)));
    if (!ok) return this.fallo(u, k);
    await this.limpiar(u, k);
    return this.iniciar(u);
  }

  // Configuración (obligatoria la primera vez): usa el setup_token que se entrega tras la contraseña.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/configurar')
  async configurar(@Headers('authorization') h?: string) {
    const u = await this.deToken(this.deBearer(h), 'mfa-setup');
    if (u.mfaActivo) throw new ConflictException('La verificación en dos pasos ya está activa.');
    const secreto = authenticator.generateSecret();
    await this.repo.update(u.id, { mfaSecreto: cifrar(secreto) });
    const otpauth = authenticator.keyuri(u.correo, 'SISG', secreto);
    return { secreto, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 240 }) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/activar')
  async activar(@Headers('authorization') h: string | undefined, @Body() { codigo }: CodigoDto, @Ip() ip: string) {
    const u = await this.deToken(this.deBearer(h), 'mfa-setup');
    const k = `mfa|${ip}|${u.id}`;
    bloqueado(k);
    this.verBloqueo(u);
    if (u.mfaActivo) throw new ConflictException('La verificación en dos pasos ya está activa.');
    if (!u.mfaSecreto) throw new HttpException('Primero genere el código QR.', 400);
    const paso = pasoValido(descifrar(u.mfaSecreto), codigo.replace(/\s/g, ''));
    if (paso === null) return this.fallo(u, k);
    const codigos = Array.from({ length: 8 }, codigoRecuperacion);
    const r = await this.repo.createQueryBuilder().update(Usuario)
      .set({ mfaActivo: true, mfaUltimoPaso: paso, mfaRecuperacion: codigos.map((x) => sha256(normalizarRecuperacion(x))) })
      .where('id = :id AND "mfaActivo" = false', { id: u.id }).execute();
    if (r.affected !== 1) throw new ConflictException('La verificación en dos pasos ya está activa.');
    await this.limpiar(u, k);
    await this.evento(u, 'MFA_ACTIVADO');
    return { ...(await this.iniciar(u)), recuperacion: codigos };
  }

  // Cierra la sesión en el servidor: todo token emitido hasta ahora deja de valer.
  @Public(false)
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() { user }: { user: { usuarioId: number; entidadId: number } }) {
    await this.repo.update(user.usuarioId, { sesionesDesde: new Date() });
    await registrar(this.bit, user, 'sesion', user.usuarioId, 'CIERRE_SESION');
    return { ok: true };
  }

  // Cambio de contraseña propio: exige la actual, cierra las demás sesiones y devuelve una sesión nueva.
  @Public(false)
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cambiar-password')
  async cambiarPassword(@Req() { user }: { user: { usuarioId: number } }, @Body() { actual, nueva }: CambiarPasswordDto) {
    const u = await this.repo.findOneOrFail({ where: { id: user.usuarioId }, select: SEG });
    if (!(await bcrypt.compare(actual, u.passwordHash))) throw new HttpException('La contraseña actual no es correcta.', 400);
    if (actual === nueva) throw new HttpException('La contraseña nueva debe ser distinta de la actual.', 400);
    await this.repo.update(u.id, { passwordHash: await bcrypt.hash(nueva, COSTO_BCRYPT), sesionesDesde: new Date(Date.now() - 1) });
    await this.evento(u, 'CAMBIO_PASSWORD');
    return this.sesion(u);
  }

  // Cada código TOTP sirve una sola vez: el paso de tiempo solo puede avanzar (la actualización condicional es atómica).
  private async consumirTotp(u: Usuario, codigo: string) {
    if (!u.mfaSecreto) return false;
    const paso = pasoValido(descifrar(u.mfaSecreto), codigo);
    if (paso === null) return false;
    const r = await this.repo.createQueryBuilder().update(Usuario).set({ mfaUltimoPaso: paso })
      .where('id = :id AND ("mfaUltimoPaso" IS NULL OR "mfaUltimoPaso" < :p)', { id: u.id, p: paso }).execute();
    return r.affected === 1;
  }
  private async consumirRecuperacion(u: Usuario, hash: string) {
    if (!u.mfaRecuperacion?.includes(hash)) return false;
    const [, filas] = await this.repo.query(`UPDATE usuario SET "mfaRecuperacion" = "mfaRecuperacion" - $1 WHERE id = $2 AND "mfaRecuperacion" @> $3::jsonb`, [hash, u.id, JSON.stringify([hash])]);
    return filas === 1;
  }
}
