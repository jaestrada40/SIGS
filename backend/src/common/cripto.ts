import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM para guardar los secretos de MFA cifrados en la base; la clave (MFA_KEY) vive solo en el entorno.
const clave = () => {
  const k = Buffer.from(process.env.MFA_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('MFA_KEY debe ser una clave de 32 bytes en base64');
  return k;
};

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(), iv);
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function descifrar(valor: string): string {
  const [iv, tag, enc] = valor.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', clave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// Códigos de recuperación de un solo uso (XXXX-XXXX, sin caracteres ambiguos). 256 es múltiplo de 32: sin sesgo.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoRecuperacion(): string {
  const c = [...randomBytes(8)].map((b) => ALFABETO[b % 32]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
export const normalizarRecuperacion = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Falla al arrancar con secretos débiles: es preferible no iniciar a iniciar inseguro.
export function validarEntorno(env: Record<string, unknown>) {
  const jwt = String(env.JWT_SECRET ?? '');
  if (jwt.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres (openssl rand -hex 32)');
  if (Buffer.from(String(env.MFA_KEY ?? ''), 'base64').length !== 32) throw new Error('MFA_KEY debe ser 32 bytes en base64 (openssl rand -base64 32)');
  return env;
}
