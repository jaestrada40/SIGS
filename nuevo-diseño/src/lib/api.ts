import { useSyncExternalStore } from "react";

export const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3000";

export type TipoEntidad = "CENTRO_DIAGNOSTICO" | "ORG_NO_LUCRATIVA";
export interface Entidad { id: number | string; nombre: string; tipo: TipoEntidad }
export type Rol = "ADMIN" | "OPERADOR" | "AUDITOR";
export const ROLES: Record<Rol, { label: string; desc: string }> = {
  ADMIN: { label: "Administrador", desc: "Gestiona usuarios, ve la auditoría y registra datos." },
  OPERADOR: { label: "Operador", desc: "Registra y actualiza pacientes, estudios o campañas." },
  AUDITOR: { label: "Auditor", desc: "Solo lectura: consulta datos y la auditoría." },
};
export interface UsuarioSesion { id: number; nombre: string; correo: string; rol: Rol }
export interface AuthResponse { entidad: Entidad; usuario: UsuarioSesion }
export interface UsuarioGestion { id: number; nombre: string; correo: string; rol: Rol; activo: boolean; mfaActivo: boolean; creadoEn: string; ultimoAcceso: string | null }
export type Geografia = Record<string, string[]>;
// Tras la contraseña el servidor nunca da sesión: pide el código MFA o exige configurarlo.
export type PasoAcceso =
  | { estado: "mfa_requerido"; mfa_token: string }
  | { estado: "mfa_configurar"; setup_token: string };
export interface MfaConfig { secreto: string; otpauth: string; qr: string }
export interface Session { entidad: Entidad; usuario: UsuarioSesion }

export type Sexo = "F" | "M" | "NE";
export interface Paciente {
  id: number | string; nombreCompleto: string; sexo: Sexo; dpi?: string | null;
  fechaNacimiento?: string | null; departamento?: string | null; municipio?: string | null;
  telefono?: string | null; contactoEmergencia?: string | null; estado?: string | null;
}
export interface Estudio {
  id: number | string; pacienteId: number | string; tipoEstudio: string; fecha: string;
  hora?: string | null; salaEquipo?: string | null; especialista?: string | null;
  estado?: string | null; resultado?: string | null; monto?: number | null;
}
export type AreaCampana = "CARDIOVASCULAR" | "RESPIRATORIA" | "PLANIFICACION" | "ONCOLOGICO_OTRO";
export type EstadoCampana = "PROGRAMADA" | "EN_CURSO" | "FINALIZADA";
export interface Campana {
  id: number | string; nombre: string; area: AreaCampana; fechaInicio: string; fechaFin?: string | null;
  departamento?: string | null; ubicacion?: string | null; personasAtendidas?: number | null; estado?: EstadoCampana | null; costo?: number | null;
}
export interface Movimiento {
  id: number | string; tabla: string; registroId: number | string;
  accion: Accion;
  detalle: { campos?: string[]; filas?: number; rol?: Rol; minutos?: number } | null; creadoEn: string;
  usuario: { id: number; nombre: string; correo: string; rol: Rol } | null;
}
export type Accion = "CREAR" | "MODIFICAR" | "IMPORTAR" | "INICIO_SESION" | "CIERRE_SESION" | "MFA_ACTIVADO" | "BLOQUEO" | "CAMBIO_PASSWORD"
  | "ACTIVAR" | "DESACTIVAR" | "RESTABLECER_MFA" | "RESTABLECER_PASSWORD" | "EXPORTAR" | "ACCESO" | "ACCESO_FALLIDO";
export type EstadoReferido = "PENDIENTE" | "AGENDADO" | "ATENDIDO" | "NO_LLEGO" | "CANCELADO";
export interface Referido {
  id: number; campanaId: number | null; nombreCompleto: string; sexo: Sexo; dpi: string | null; fechaNacimiento: string | null; telefono: string | null;
  tipoEstudio: string; motivo: string | null; estado: EstadoReferido; codigo: string; fechaCita: string | null; creadoEn: string; atendidoEn: string | null;
  /** El centro, para quien envía; el organismo, para quien recibe. */
  contraparte: string;
}
export interface CentroReferencia { id: number; nombre: string; departamento: string | null }
export interface ResumenReferidos { total: number; pendientes: number; atendidos: number; noLlegaron: number; tasaAtencion: number | null }
interface Demografia { pacientes: number; sexo: { sexo: string; total: number }[]; edades: { rango: string; total: number }[]; departamentos: { departamento: string; total: number }[] }
export interface PuntoMes { mes: string; valor: number; ingresos?: number }
export interface Barra { etiqueta: string; valor: number; ingresos?: number; campanas?: number }
export type ImpactoCentro = Demografia & {
  tipo: "CENTRO"; generadoEn: string; porMes: PuntoMes[]; porTipo: Barra[]; referidos: ResumenReferidos;
  resumen: { estudios: number; realizados: number; programados: number; cancelados: number; tasaCancelacion: number | null; ingresos: number; ticketPromedio: number | null; realizadosConMonto: number; realizadosSinMonto: number };
};
export type ImpactoOrg = Demografia & {
  tipo: "ORG"; generadoEn: string; porMes: PuntoMes[]; porArea: Barra[]; porDepartamento: Barra[]; referidos: ResumenReferidos;
  porCampana: (Barra & { id: number; costo: number | null; referidos: number; atendidos: number })[];
  resumen: { campanas: number; enCurso: number; personas: number; costo: number; campanasConCosto: number; costoPorPersona: number | null };
};
export type Impacto = ImpactoCentro | ImpactoOrg;
export interface Alerta { clave: string; nivel: "alta" | "media"; cantidad: number; mensaje: string; ruta: string }
export interface EnlaceResultado { id: number; expiraEn: string; revocadoEn: string | null; accesos: number; intentosFallidos: number; ultimoAccesoEn: string | null; creadoEn: string }
export interface ResultadoPublico { centro: string; paciente: string; tipoEstudio: string; fecha: string; resultado: string; expiraEn: string }
export type DashboardCentro = { totalPacientes: number; totalEstudios: number };
export type DashboardOrg = { totalPacientes: number; totalCampanas: number; totalPersonasAtendidas: number };

// ---------- Sesión ----------
const KEY = "sisg.session";
const listeners = new Set<() => void>();
let cached: Session | null | undefined;

function read(): Session | null {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return null;
  try { cached = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { cached = null; }
  if (cached && !cached.usuario) cached = null;   // sesión de una versión anterior (sin rol): pedir acceso de nuevo
  return cached ?? null;
}
export function setSession(s: Session | null) {
  cached = s;
  if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
export const esAdmin = (s: Session | null) => s?.usuario.rol === "ADMIN";
export const puedeEscribir = (s: Session | null) => !!s && s.usuario.rol !== "AUDITOR";
export const veAuditoria = (s: Session | null) => s?.usuario.rol === "ADMIN" || s?.usuario.rol === "AUDITOR";
export function getSession() { return read(); }
export function useSession() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => null,
  );
}

// ---------- Cliente ----------
export class ApiError extends Error {
  status: number; errores?: { fila: number; mensaje: string }[] | undefined;
  constructor(status: number, message: string, errores?: { fila: number; mensaje: string }[]) {
    super(message); this.status = status; this.errores = errores;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = read();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const credentials: RequestCredentials = "include";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, credentials, headers: { ...headers, ...(init.headers as object) } });
  } catch {
    throw new ApiError(0, "No pudimos conectar con el servidor. Verifique su conexión e intente de nuevo.");
  }
  if (res.status === 401 && !path.startsWith("/auth/") && !path.startsWith("/publico/")) {
    setSession(null);
    throw new ApiError(401, "Su sesión expiró. Inicie sesión de nuevo.");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const m = body?.message;
    const msg = Array.isArray(m) ? m.join(" · ") : typeof m === "string" ? m : "Ocurrió un error inesperado.";
    throw new ApiError(res.status, msg, body?.errores);
  }
  return body as T;
}

const post = <T,>(p: string, b: unknown) => request<T>(p, { method: "POST", body: JSON.stringify(b) });
const patch = <T,>(p: string, b: unknown) => request<T>(p, { method: "PATCH", body: JSON.stringify(b) });

export const api = {
  login: (b: { correo: string; password: string }) => post<PasoAcceso>("/auth/login", b),
  // Revoca en el servidor todos los tokens de esta entidad; si falla, igual se cierra la sesión local.
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }).catch(() => null),
  mfaVerificar: (b: { mfa_token: string; codigo: string }) => post<AuthResponse>("/auth/mfa/verificar", b),
  mfaConfigurar: (setupToken: string) => request<MfaConfig>("/auth/mfa/configurar", { method: "POST", headers: { Authorization: `Bearer ${setupToken}` } }),
  mfaActivar: (setupToken: string, codigo: string) =>
    request<AuthResponse & { recuperacion: string[] }>("/auth/mfa/activar", { method: "POST", body: JSON.stringify({ codigo }), headers: { Authorization: `Bearer ${setupToken}` } }),
  registro: (b: { nombre: string; tipo: TipoEntidad; correo: string; password: string; departamento?: string | undefined; telefono?: string | undefined }) =>
    post<PasoAcceso>("/auth/registro", b),
  dashboard: () => request<DashboardCentro | DashboardOrg>("/dashboard"),
  pacientes: () => request<Paciente[]>("/pacientes"),
  paciente: (id: string | number) => request<Paciente>(`/pacientes/${id}`),
  crearPaciente: (b: Omit<Paciente, "id">) => post<Paciente>("/pacientes", b),
  editarPaciente: (id: string | number, b: Partial<Paciente>) => patch<Paciente>(`/pacientes/${id}`, b),
  importarPacientes: (filas: unknown[]) => post<{ importados: number }>("/pacientes/importar", { filas }),
  estudios: () => request<Estudio[]>("/estudios"),
  crearEstudio: (b: Omit<Estudio, "id">) => post<Estudio>("/estudios", b),
  editarEstudio: (id: string | number, b: Partial<Estudio>) => patch<Estudio>(`/estudios/${id}`, b),
  importarEstudios: (filas: unknown[]) => post<{ importados: number }>("/estudios/importar", { filas }),
  campanas: () => request<Campana[]>("/campanas"),
  crearCampana: (b: Omit<Campana, "id">) => post<Campana>("/campanas", b),
  editarCampana: (id: string | number, b: Partial<Campana>) => patch<Campana>(`/campanas/${id}`, b),
  bitacora: () => request<Movimiento[]>("/bitacora"),
  fhir: (recurso: "Patient" | "DiagnosticReport" | "Organization") => request<unknown>(`/fhir/${recurso}`),
  sincronizarJornada: (campanaId: number, items: unknown[]) => post<{ resultados: { claveCliente: string; estado: "ok" | "duplicado" | "repetido" | "error"; mensaje?: string }[] }>("/jornada/sincronizar", { campanaId, items }),
  alertas: () => request<Alerta[]>("/alertas"),
  enlaces: (estudioId: number | string) => request<EnlaceResultado[]>(`/enlaces?estudioId=${estudioId}`),
  crearEnlace: (estudioId: number | string, dias: number) => post<{ id: number; token: string; expiraEn: string }>("/enlaces", { estudioId: Number(estudioId), dias }),
  revocarEnlace: (id: number) => post<{ ok: boolean }>(`/enlaces/${id}/revocar`, {}),
  verResultado: (token: string, verificacion: string) => post<ResultadoPublico>("/publico/resultado", { token, verificacion }),
  impacto: () => request<Impacto>("/impacto"),
  referidos: () => request<Referido[]>("/referidos"),
  centrosReferencia: () => request<CentroReferencia[]>("/referidos/centros"),
  crearReferido: (b: { pacienteId: number; campanaId?: number | undefined; centroId: number; tipoEstudio: string; motivo?: string | undefined; consentimiento: boolean }) => post<Referido>("/referidos", b),
  agendarReferido: (id: number, b: { fecha: string; hora?: string | undefined }) => post<{ ok: boolean }>(`/referidos/${id}/agendar`, b),
  noLlegoReferido: (id: number) => post<{ ok: boolean }>(`/referidos/${id}/no-llego`, {}),
  cancelarReferido: (id: number) => post<{ ok: boolean }>(`/referidos/${id}/cancelar`, {}),
  registrarExportacion: (recurso: "paciente" | "estudio" | "campana" | "bitacora" | "referido" | "impacto", filas: number) => post<{ ok: boolean }>("/bitacora/exportacion", { recurso, filas }),
  geografia: () => request<Geografia>("/catalogos/geografia"),
  cambiarPassword: (b: { actual: string; nueva: string }) => post<AuthResponse>("/auth/cambiar-password", b),
  usuarios: () => request<UsuarioGestion[]>("/usuarios"),
  crearUsuario: (b: { nombre: string; correo: string; rol: Rol; password: string }) => post<UsuarioGestion>("/usuarios", b),
  editarUsuario: (id: number, b: { nombre?: string; rol?: Rol; activo?: boolean }) => patch<UsuarioGestion>(`/usuarios/${id}`, b),
  restablecerMfa: (id: number) => post<{ ok: boolean }>(`/usuarios/${id}/restablecer-mfa`, {}),
  restablecerPassword: (id: number, password: string) => post<{ ok: boolean }>(`/usuarios/${id}/restablecer-password`, { password }),
};

// ---------- Formato ----------
export const fmtQ = (n: number) => `Q ${new Intl.NumberFormat("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
export const fmtNum = (n: number) => new Intl.NumberFormat("es-GT").format(n);
export function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export function tiempoRelativo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es-GT", { numeric: "auto" });
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 2592000) return rtf.format(-Math.round(diff / 86400), "day");
  return fmtFecha(iso);
}
export function saludo(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}
export const esCentro = (e?: Entidad | null) => e?.tipo === "CENTRO_DIAGNOSTICO";
