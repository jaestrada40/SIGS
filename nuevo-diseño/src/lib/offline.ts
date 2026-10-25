// Cola de registros de jornada para trabajar sin conexión.
// Cada registro se cifra (AES-GCM) con una clave derivada de una contraseña de jornada (PBKDF2) antes de tocar el disco del dispositivo.
// La clave solo vive en memoria: al recargar hay que desbloquear de nuevo. Si se olvida la contraseña, lo pendiente no se puede recuperar.
// Límite conocido: protege contra quien copie los datos del navegador, no contra quien conozca la contraseña ni contra un dispositivo ya comprometido.
import { api, ApiError, type Paciente } from "./api";

export const ITERACIONES = 310_000;
export const MIN_CLAVE = 8;

export interface ItemJornada {
  claveCliente: string;   // uuid generado en el dispositivo: hace la sincronización idempotente
  campanaId: number;
  atendidoEn: string;     // ISO
  paciente: Omit<Paciente, "id">;
}
export interface Sellado { iv: Uint8Array<ArrayBuffer>; datos: Uint8Array<ArrayBuffer> }

const enc = new TextEncoder(), dec = new TextDecoder();

export async function derivarClave(clave: string, sal: Uint8Array<ArrayBuffer>, iteraciones = ITERACIONES): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function sellar(k: CryptoKey, valor: unknown): Promise<Sellado> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, datos: new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(valor)))) };
}
export async function abrirSello<T>(k: CryptoKey, s: Sellado): Promise<T> {
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: s.iv }, k, s.datos))) as T;
}

// ---- IndexedDB -------------------------------------------------------------------------------------------------
const DB = "sisg-jornada";
type Fila = { id: string; error?: string } & Sellado;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("meta"); r.result.createObjectStore("cola", { keyPath: "id" }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error ?? new Error("No se pudo abrir el almacenamiento del dispositivo."));
  });
}
async function tx<T>(store: "meta" | "cola", modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, mal) => { const r = f(db.transaction(store, modo).objectStore(store)); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error ?? new Error("Error de almacenamiento.")); });
  } finally { db.close(); }
}

export const tieneClave = async () => (await tx("meta", "readonly", (s) => s.get("sal"))) !== undefined;

export async function crearClave(clave: string): Promise<CryptoKey> {
  if (clave.length < MIN_CLAVE) throw new Error(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const k = await derivarClave(clave, sal);
  const verificador = await sellar(k, "ok");   // permite comprobar la contraseña sin guardarla
  await tx("meta", "readwrite", (s) => s.put(sal, "sal"));
  await tx("meta", "readwrite", (s) => s.put(verificador, "verificador"));
  return k;
}

export async function desbloquear(clave: string): Promise<CryptoKey> {
  const sal = await tx<Uint8Array<ArrayBuffer>>("meta", "readonly", (s) => s.get("sal"));
  const ver = await tx<Sellado>("meta", "readonly", (s) => s.get("verificador"));
  if (!sal || !ver) throw new Error("No hay contraseña de jornada creada en este dispositivo.");
  const k = await derivarClave(clave, sal);
  try { await abrirSello(k, ver); } catch { throw new Error("Contraseña incorrecta."); }
  return k;
}

export const contarPendientes = () => tx("cola", "readonly", (s) => s.count());

export async function encolar(k: CryptoKey, item: ItemJornada): Promise<void> {
  const fila: Fila = { id: item.claveCliente, ...(await sellar(k, item)) };
  await tx("cola", "readwrite", (s) => s.put(fila));
}
export async function listar(k: CryptoKey): Promise<{ id: string; item: ItemJornada; error?: string }[]> {
  const filas = await tx<Fila[]>("cola", "readonly", (s) => s.getAll());
  return Promise.all(filas.map(async (f) => ({ id: f.id, item: await abrirSello<ItemJornada>(k, f), ...(f.error ? { error: f.error } : {}) })));
}
export const quitar = (id: string) => tx("cola", "readwrite", (s) => s.delete(id));
export async function marcarError(id: string, error: string) {
  const f = await tx<Fila | undefined>("cola", "readonly", (s) => s.get(id));
  if (f) await tx("cola", "readwrite", (s) => s.put({ ...f, error }));
}

// ---- Sincronización ----------------------------------------------------------------------------------------------
export interface ResumenSync { enviados: number; yaEstaban: number; repetidos: number; conError: number; pendientes: number; detenido?: string }
const LOTE = 50;

/** Envía lo pendiente, campaña por campaña. Lo que el servidor acepta (o ya tenía) sale de la cola; lo rechazado se queda con su motivo. */
export async function sincronizar(k: CryptoKey): Promise<ResumenSync> {
  const r: ResumenSync = { enviados: 0, yaEstaban: 0, repetidos: 0, conError: 0, pendientes: 0 };
  const porCampana = new Map<number, ItemJornada[]>();
  // En orden de captura: si dos registros son la misma persona, gana el primero que se tomó.
  for (const { item, error } of (await listar(k)).sort((x, y) => x.item.atendidoEn.localeCompare(y.item.atendidoEn))) if (!error) porCampana.set(item.campanaId, [...(porCampana.get(item.campanaId) ?? []), item]);
  try {
    for (const [campanaId, items] of porCampana) {
      for (let i = 0; i < items.length; i += LOTE) {
        const lote = items.slice(i, i + LOTE);
        try {
          const { resultados } = await api.sincronizarJornada(campanaId, lote.map(({ claveCliente, paciente, atendidoEn }) => ({ claveCliente, paciente, atendidoEn })));
          for (const x of resultados) {
            if (x.estado === "error") { r.conError++; await marcarError(x.claveCliente, x.mensaje ?? "El servidor rechazó el registro."); continue; }
            await quitar(x.claveCliente);
            if (x.estado === "ok") r.enviados++; else if (x.estado === "duplicado") r.yaEstaban++; else r.repetidos++;
          }
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) { for (const it of lote) { r.conError++; await marcarError(it.claveCliente, "La campaña ya no existe."); } continue; }
          throw e;
        }
      }
    }
  } catch (e) { r.detenido = e instanceof ApiError && e.status === 0 ? "Sin conexión" : e instanceof ApiError ? e.message : "No se pudo sincronizar."; }
  r.pendientes = await contarPendientes();
  return r;
}
