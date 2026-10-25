// Interpretación y validación de los datos que el OCR lee del DPI guatemalteco. Todo es código puro (sin navegador) para poder probarlo.
// Regla de oro: un dato solo se marca «verificado» si pasó una comprobación real (dígito verificador, catálogo, dos fuentes que coinciden).
// Lo demás queda «por revisar» y la persona lo confirma o lo corrige a mano; nunca se inventa un valor.
import type { Geografia } from "./api";

export type Estado = "verificado" | "revisar";
export type Campo<T extends string = string> = { valor: T; estado: Estado; nota?: string };
export type DpiLectura = {
  dpi?: Campo; nombreCompleto?: Campo; sexo?: Campo<"F" | "M">; fechaNacimiento?: Campo; departamento?: Campo; municipio?: Campo;
};
export const lecturaVacia = (l: DpiLectura) => !Object.values(l).some(Boolean);

// ---------------------------------------------------------------------------------------------------------------- utilidades
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Mayúsculas, sin tildes ni signos y con espacios simples: sirve para comparar textos del OCR con el catálogo. */
export const norm = (s: string) => sinTildes(s).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const f = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) f[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    f[i]![j] = Math.min(f[i - 1]![j]! + 1, f[i]![j - 1]! + 1, f[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return f[a.length]![b.length]!;
}
const tolerancia = (largo: number) => (largo >= 9 ? 2 : largo >= 5 ? 1 : 0);

/** Confusiones habituales del OCR entre letras y dígitos, para zonas que SOLO pueden ser numéricas. */
const aDigitos = (s: string) => s.replace(/[OQD]/g, "0").replace(/[IL|]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/G/g, "6").replace(/B/g, "8");

export function tituloNombre(s: string) {
  return s.toLowerCase().split(" ").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// ---------------------------------------------------------------------------------------------------------------- CUI (DPI)
// Número de 13 dígitos: 8 de número + 1 verificador + 2 del departamento + 2 del municipio de inscripción.
const MUNIS_POR_DEPTO = [17, 8, 16, 16, 13, 14, 19, 8, 24, 21, 9, 30, 32, 21, 8, 17, 14, 5, 11, 11, 7, 17];
const CODIGO_DEPTO = ["Guatemala", "El Progreso", "Sacatepéquez", "Chimaltenango", "Escuintla", "Santa Rosa", "Sololá", "Totonicapán", "Quetzaltenango", "Suchitepéquez", "Retalhuleu", "San Marcos", "Huehuetenango", "Quiché", "Baja Verapaz", "Alta Verapaz", "Petén", "Izabal", "Zacapa", "Chiquimula", "Jalapa", "Jutiapa"];
export const departamentoDeCodigo = (n: number) => CODIGO_DEPTO[n - 1];

export function digitoVerificadorCui(numero8: string) {
  let suma = 0;
  for (let i = 0; i < 8; i++) suma += Number(numero8[i]) * (i + 2);
  return suma % 11;
}

export function validarCui(cui: string): { valido: boolean; departamentoCodigo?: number; motivo?: string } {
  if (!/^\d{13}$/.test(cui)) return { valido: false, motivo: "no tiene 13 dígitos" };
  const departamentoCodigo = Number(cui.slice(9, 11)), municipioCodigo = Number(cui.slice(11, 13));
  if (digitoVerificadorCui(cui.slice(0, 8)) !== Number(cui[8])) return { valido: false, departamentoCodigo, motivo: "el dígito verificador no coincide" };
  if (departamentoCodigo < 1 || departamentoCodigo > 22) return { valido: false, departamentoCodigo, motivo: "el código de departamento no existe" };
  // +3 de margen: se crearon municipios después de la numeración que usa esta regla.
  if (municipioCodigo < 1 || municipioCodigo > MUNIS_POR_DEPTO[departamentoCodigo - 1]! + 3) return { valido: false, departamentoCodigo, motivo: "el código de municipio no existe" };
  return { valido: true, departamentoCodigo };
}

const CONFUNDIBLES: Record<string, string[]> = { "0": ["8", "6", "9"], "1": ["7"], "2": ["7"], "3": ["8", "5"], "4": ["9"], "5": ["6", "3"], "6": ["5", "8", "0"], "7": ["1", "2"], "8": ["3", "0", "6", "9"], "9": ["8", "0", "4"] };
/** Intenta arreglar UN solo dígito mal leído usando el dígito verificador. Devuelve null si no hay una única corrección. */
export function repararCui(cui: string): string | null {
  if (!/^\d{13}$/.test(cui)) return null;
  const validas = new Set<string>();
  for (let i = 0; i < 13; i++) for (const alt of CONFUNDIBLES[cui[i]!] ?? []) {
    const c = cui.slice(0, i) + alt + cui.slice(i + 1);
    if (validarCui(c).valido) validas.add(c);
  }
  return validas.size === 1 ? [...validas][0]! : null;
}

// ---------------------------------------------------------------------------------------------------------------- MRZ (zona de lectura automática)
const PESOS = [7, 3, 1];
const valorMrz = (c: string) => (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);
export const digitoIcao = (s: string) => [...s].reduce((a, c, i) => a + valorMrz(c) * PESOS[i % 3]!, 0) % 10;

const aFecha = (yymmdd: string, hoy = new Date()) => {
  const yy = Number(yymmdd.slice(0, 2)), mm = yymmdd.slice(2, 4), dd = yymmdd.slice(4, 6);
  const siglo = 2000 + yy > hoy.getFullYear() ? 1900 : 2000;   // un nacimiento no puede estar en el futuro
  return fechaValida(siglo + yy, Number(mm), Number(dd), hoy) ? `${siglo + yy}-${mm}-${dd}` : undefined;
};

export type Mrz = { cui?: string; nombre?: string; piezasNombre?: string[]; sexo?: "F" | "M"; nacimiento?: string; nacimientoVerificado?: boolean };

/** Palabras de la línea de nombres. El OCR lee los «<» de relleno como K, L, C, E, S…: se quita esa cola y se separa por «<». */
function nombreDeLineaMrz(linea: string): { piezas: string[]; nombre: string; grupos: boolean } | undefined {
  let corte = -1;
  for (let i = 0; i < linea.length; i++) if (linea[i] === "<" && /^[<KLCEXSI1]{6,}$/.test(linea.slice(i))) { corte = i; break; }
  const parte = (corte >= 0 ? linea.slice(0, corte) : linea).replace(/^<+/, "");
  if (parte.replace(/[^A-Z]/g, "").length < 5) return undefined;
  const grupos = parte.includes("<<");
  if (grupos) {
    const [ape = "", nom = ""] = parte.split(/<<+/);
    const p = (s: string) => s.split("<").filter((w) => w.length >= 2);
    const piezas = [...p(nom), ...p(ape)];
    return piezas.length ? { piezas, nombre: piezas.join(" "), grupos } : undefined;
  }
  // Sin «<<» fiables (el OCR los deformó): el primer bloque es el apellido y el resto los nombres.
  const w = parte.split("<").filter((x) => x.length >= 2);
  if (w.length < 2) return undefined;
  const piezas = [...w.slice(1), w[0]!];
  return { piezas, nombre: piezas.join(" "), grupos };
}

export function leerMrz(textos: string[]): Mrz {
  const lineas = textos.flatMap((t) => t.toUpperCase().split(/\r?\n/)).map((l) => l.replace(/[^A-Z0-9<]/g, "")).filter((l) => l.length >= 12);
  const out: Mrz = {};

  // Línea 1 (ICAO TD1): «ID» + «GTM» + número de documento (9) + DÍGITO DE CONTROL + dato opcional.
  // En el DPI el CUI de 13 dígitos se parte así: los 9 primeros van en el número de documento y los 4 del lugar abren el dato opcional,
  // con el dígito de control de la franja en medio. Por eso NO sirven 13 dígitos seguidos después de «GTM».
  for (const l of lineas) {
    const i = l.indexOf("GTM");
    if (i < 0) continue;
    const resto = l.slice(i + 3);
    const doc = aDigitos(resto.slice(0, 9)), control = aDigitos(resto.slice(9, 10)), lugar = aDigitos(resto.slice(10, 14));
    if (/^\d{9}$/.test(doc) && /^\d$/.test(control) && /^\d{4}$/.test(lugar) && digitoIcao(doc) === Number(control)) { out.cui = doc + lugar; break; }
  }

  // Línea 2: nacimiento AAMMDD + verificador + sexo + vencimiento…
  for (const l of lineas) {
    const d = aDigitos(l);
    const m = d.match(/(\d{6})(\d)([MF])(\d{6})(\d)/);
    if (!m) continue;
    const ok = digitoIcao(m[1]!) === Number(m[2]);
    const fecha = aFecha(m[1]!);
    if (fecha && (ok || !out.nacimiento)) { out.nacimiento = fecha; out.nacimientoVerificado = ok; }
    out.sexo = m[3] as "F" | "M";
    if (ok) break;
  }

  // Línea 3: APELLIDOS<<NOMBRES (la franja del DPI solo trae el primer apellido y el primer nombre).
  const candidatas = lineas.filter((l) => !/\d/.test(l) && l.length >= 18 && l.includes("<")).map(nombreDeLineaMrz).filter((x): x is NonNullable<typeof x> => !!x);
  const mejor = candidatas.sort((a, b) => Number(b.grupos) - Number(a.grupos) || b.nombre.length - a.nombre.length)[0];
  if (mejor) { out.nombre = mejor.nombre; out.piezasNombre = mejor.piezas; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- fechas
const MESES: Record<string, number> = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12 };
function fechaValida(a: number, m: number, d: number, hoy = new Date()) {
  if (a < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const f = new Date(a, m - 1, d);
  return f.getMonth() === m - 1 && f.getDate() === d && f <= hoy && hoy.getFullYear() - a <= 120;
}
const pad = (n: number) => String(n).padStart(2, "0");

/** Todas las fechas plausibles del texto como [aaaa-mm-dd, posición, corregida]. «corregida»: hubo letras leídas como dígitos (O por 0, S por 5…), así que no es fiable. */
function fechasEnTexto(texto: string, hoy = new Date()): [string, number, boolean][] {
  const out: [string, number, boolean][] = [];
  const crudo = sinTildes(texto).toUpperCase();
  for (const m of crudo.matchAll(/\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})\b/g)) {
    const [d, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (fechaValida(a, mo, d, hoy)) out.push([`${a}-${pad(mo)}-${pad(d)}`, m.index ?? 0, false]);
  }
  // 06ENE1990, 06 ENE 1990, 6 de enero de 1990…
  for (const m of crudo.matchAll(/(?<![A-Z0-9])([0-9OQIL|S]{1,2})\s*(?:DE\s+)?-?\s*([A-Z]{3})[A-Z]*\.?\s*(?:DE\s+|-)?\s*([0-9OQIL|SB]{4})(?![A-Z0-9])/g)) {
    const mes = MESES[m[2]!]; if (!mes) continue;
    const [d, a] = [Number(aDigitos(m[1]!)), Number(aDigitos(m[3]!))];
    if (fechaValida(a, mes, d, hoy)) out.push([`${a}-${pad(mes)}-${pad(d)}`, m.index ?? 0, /[^0-9]/.test(m[1]! + m[3]!)]);
  }
  return out.sort((x, y) => x[1] - y[1]);
}

// ---------------------------------------------------------------------------------------------------------------- campos del frente
/** Los nombres impresos en el DPI van en mayúsculas: una línea con minúsculas es un título o ruido del OCR, no un nombre. */
const esMayus = (s: string) => !/[a-záéíóúüñ]/.test(s);
const lineasDe = (textos: string[]) => textos.flatMap((t) => t.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);

const ETIQUETAS = /^(NOMBRES?|APELLIDOS?|FECHA|SEXO|NACIONALIDAD|PAIS|VECINDAD|LUGAR|ESTADO|CUI|DPI|CODIGO|UNICO|DOCUMENTO|REPUBLICA|REGISTRO|VENCIMIENTO|EMISION|CIVIL|FIRMA|NUMERO|SERIE)\b/;

/** Texto que sigue a una etiqueta: el resto de su línea y las líneas siguientes que sean solo letras (el DPI parte «NOMBRE» y «APELLIDO» en dos líneas). Conserva tildes y ñ. */
function bloqueTrasEtiqueta(lineas: string[], etiqueta: RegExp, maxLineas = 3): string | undefined {
  const mayus = (s: string) => s.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ ]/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < lineas.length; i++) {
    const orig = lineas[i]!;
    const base = sinTildes(orig).toUpperCase();   // misma longitud que el original si las tildes vienen precompuestas
    const m = base.match(etiqueta);
    if (!m) continue;
    const partes: string[] = [];
    const cola = base.length === orig.length ? orig.slice((m.index ?? 0) + m[0].length) : base.slice((m.index ?? 0) + m[0].length);
    const resto = esMayus(cola) ? mayus(cola) : "";
    if (resto.length >= 2) partes.push(resto);
    let saltadas = 0;
    for (let j = i + 1; j < lineas.length && partes.length < maxLineas && j <= i + 6; j++) {
      const l = lineas[j]!;
      if (/\d/.test(l.replace(/[Il|]/g, ""))) break;                      // un número o una fecha corta el bloque
      if (!esMayus(l)) { if (++saltadas > 2) break; continue; }           // texto en minúsculas = ruido del OCR: se salta, no entra al nombre
      const sig = mayus(l);
      if (sig.length < 2 || ETIQUETAS.test(norm(sig))) break;
      partes.push(sig);
    }
    if (partes.length) return partes.join(" ");
  }
  return undefined;
}

const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y"]);
const limpiaNombre = (s?: string) => (s ?? "").split(" ").filter((p) => /^[A-ZÁÉÍÓÚÜÑ]+$/.test(p) && (p.length >= 3 || PARTICULAS.has(p))).join(" ");

function nombreConEtiquetas(lineas: string[]): string | undefined {
  const nombres = limpiaNombre(bloqueTrasEtiqueta(lineas, /\bNOMBRES?\b(?:\s*\(?S\)?)?/));
  const apellidos = limpiaNombre(bloqueTrasEtiqueta(lineas, /\bAPELLIDOS?\b/));
  return nombres && apellidos && (nombres + apellidos).length >= 5 ? `${nombres} ${apellidos}` : undefined;
}

// Cuando el OCR no alcanza a leer las etiquetas «NOMBRE» y «APELLIDO» (son muy pequeñas), el nombre se reconoce por su posición:
// el bloque de líneas con solo palabras que sigue al número de DPI y que no es una etiqueta ni un título del documento.
const NO_ES_NOMBRE = /(REPUBLICA|REGISTRO|NACIONAL|PERSONA|DOCUMENTO|IDENTIFICACION|CENTROAMERICA|CODIGO|UNICO|FECHA|NACIMIENTO|NACIONALIDAD|SEXO|MASCULINO|FEMENINO|FIRMA|NOMBRE|APELLIDO|CUI|DPI|ESTADO|CIVIL|VECINDAD|LUGAR|VENCIMIENTO|NUMERO|SERIE|RENAP|SOLTERO|CASADO|UNIDO|VIUDO|DIVORCIADO|GUATEMALA|GTM)/;
function palabrasDeNombre(linea: string): string[] | "numero" | null {
  const conDigitos = /\d/.test(linea.replace(/[Il|]/g, ""));
  let texto = linea;
  if (conDigitos) {
    const cola = linea.match(/\d\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+)$/);   // «1617 18612 0301 JAVIER»: solo cuenta lo que va después del número
    if (!cola) return "numero";
    texto = cola[1]!;
    if (!texto.split(" ").some((p) => p.length >= 4)) return "numero";
  }
  if (NO_ES_NOMBRE.test(norm(texto))) return null;
  if (/[a-záéíóúüñ]/.test(texto)) return null;   // los nombres del DPI van en mayúsculas; un título deformado por el OCR («Codig Rondicode») no
  const pal = texto.toUpperCase().split(/\s+/).filter(Boolean);
  if (!pal.length || !pal.every((p) => /^[A-ZÁÉÍÓÚÜÑ]+$/.test(p) && (p.length >= 3 || PARTICULAS.has(p)))) return null;
  return pal;
}

function nombreEstructural(texto: string): string | undefined {
  const corridas: { tokens: string[]; trasNumero: boolean }[] = [];
  let actual: string[] = [], trasNumero = false, vistoNumero = false;
  const cerrar = () => { if (actual.length) corridas.push({ tokens: actual, trasNumero }); actual = []; };
  for (const linea of texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    // «NOMBRE:» y «APELLIDO:» van entre el bloque de nombres y el de apellidos: no cortan la corrida.
    if (/^(NOMBRES?|APELLIDOS?)\b/.test(norm(linea)) && norm(linea).split(" ").length <= 2) continue;
    const r = palabrasDeNombre(linea);
    if (r === "numero") { cerrar(); vistoNumero = true; continue; }
    if (r === null) { cerrar(); continue; }
    if (!actual.length) trasNumero = vistoNumero;
    actual.push(...r);
  }
  cerrar();
  const validas = corridas.filter((c) => c.tokens.length >= 2 && c.tokens.length <= 8 && c.tokens.join("").length >= 6);
  const mejor = validas.sort((a, b) => Number(b.trasNumero) - Number(a.trasNumero) || b.tokens.length - a.tokens.length)[0];
  return mejor?.tokens.join(" ");
}

/** El nombre del frente: con etiquetas si se leyeron; si no, por posición en cada pasada. Gana el candidato que más se repite (los incompletos votan por el más completo). */
function nombreDelFrente(textos: string[], piezasMrz?: string[]): string | undefined {
  let candidatos = [nombreConEtiquetas(lineasDe(textos)), ...textos.map(nombreEstructural)].filter((c): c is string => !!c);
  if (piezasMrz && piezasMrz.length >= 2) {   // con la franja: solo valen los candidatos que contienen el primer nombre y el primer apellido que ella da
    const contiene = (c: string, p: string) => norm(c).split(" ").some((x) => lev(x, norm(p)) <= (norm(p).length >= 5 ? 1 : 0));
    const coherentes = candidatos.filter((c) => piezasMrz.every((p) => contiene(c, p)));
    if (coherentes.length) candidatos = coherentes;
  }
  if (!candidatos.length) return undefined;
  const palabras = (c: string) => norm(c).split(" ");
  const votos = candidatos.map((c) => candidatos.filter((o) => palabras(o).every((p) => palabras(c).includes(p))).length);   // o está contenido en c
  const mejor = candidatos.map((c, i) => ({ c, v: votos[i]!, n: palabras(c).length })).sort((a, b) => b.v - a.v || b.n - a.n)[0]!;
  return mejor.c;
}

function sexoDelFrente(lineas: string[]): "F" | "M" | undefined {
  for (let i = 0; i < lineas.length; i++) {
    if (!/\bSEXO\b/.test(norm(lineas[i]!))) continue;
    const v = norm(`${lineas[i]!} ${lineas[i + 1] ?? ""}`).replace(/^.*\bSEXO\b/, "").trim().split(" ")[0] ?? "";
    if (v === "M" || v === "MASCULINO" || v === "MASC") return "M";
    if (v === "F" || v === "FEMENINO" || v === "FEM") return "F";
  }
  // Sin la etiqueta legible: solo vale la palabra completa; una F o una M suelta podría ser parte de cualquier otra cosa.
  const palabra = lineas.map((l) => norm(l)).join(" ").match(/\b(MASCULINO|FEMENINO)\b/);
  return palabra ? (palabra[1] === "MASCULINO" ? "M" : "F") : undefined;
}

function fechaDelFrente(textos: string[], hoy: Date): { fecha?: string | undefined; etiquetada: boolean; corregida: boolean } {
  const lineas = lineasDe(textos);
  for (let i = 0; i < lineas.length; i++) {
    if (!/NACIMIENTO/.test(norm(lineas[i]!))) continue;
    const f = fechasEnTexto(lineas.slice(i, i + 3).join("\n"), hoy)[0];
    if (f) return { fecha: f[0], etiquetada: true, corregida: f[2] };
  }
  const todas = textos.flatMap((t) => fechasEnTexto(t, hoy)).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { fecha: todas[0]?.[0], etiquetada: false, corregida: todas[0]?.[2] ?? false };   // sin etiqueta: la más antigua (emisión y vencimiento son posteriores)
}

// ---------------------------------------------------------------------------------------------------------------- lugar (catálogo)
type Hallazgo = { depto?: string; muni?: string; exacto: boolean; sinEtiqueta: boolean };

/** Busca en un texto nombres del catálogo (con tolerancia a errores del OCR). true = coincidencia exacta. */
function nombresEnTexto(texto: string, nombres: string[]): Map<string, boolean> {
  const t = norm(texto), palabras = t.split(" ");
  const out = new Map<string, boolean>();
  for (const nombre of nombres) {
    const n = norm(nombre), k = n.split(" ").length;
    if ((" " + t + " ").includes(" " + n + " ")) { out.set(nombre, true); continue; }
    for (let i = 0; i + k <= palabras.length; i++) {
      const trozo = palabras.slice(i, i + k).join(" ");
      if (Math.abs(trozo.length - n.length) <= 2 && lev(trozo, n) <= tolerancia(n.length)) { if (!out.has(nombre)) out.set(nombre, false); break; }
    }
  }
  return out;
}

function elegirLugar(ventana: string, geo: Geografia, codigoDepto: string | undefined): Omit<Hallazgo, "sinEtiqueta"> | undefined {
  const deptos = Object.keys(geo);
  const dHalladas = nombresEnTexto(ventana, deptos);
  const todosMunis = deptos.flatMap((d) => geo[d]!.map((m) => [d, m] as const));
  const mHalladas = nombresEnTexto(ventana, [...new Set(todosMunis.map(([, m]) => m))]);
  // municipio que pertenece a un departamento hallado (o al código del DPI); si solo hay un departamento posible, también sirve
  const candidatos: { depto: string; muni: string; exacto: boolean }[] = [];
  for (const [muni, ex] of mHalladas) for (const [d] of todosMunis.filter(([, m]) => m === muni)) candidatos.push({ depto: d, muni, exacto: ex });
  const coherente = candidatos.filter((c) => dHalladas.has(c.depto) || c.depto === codigoDepto);
  const unicoDepto = candidatos.length > 0 && new Set(candidatos.map((c) => c.depto)).size === 1;
  const elegido = (coherente.length ? coherente : unicoDepto ? candidatos : [])
    .sort((a, b) => Number(b.exacto) - Number(a.exacto) || b.muni.length - a.muni.length)[0];   // «Antigua Guatemala» gana a «Guatemala»
  if (elegido) return { depto: elegido.depto, muni: elegido.muni, exacto: elegido.exacto && (dHalladas.get(elegido.depto) ?? false) };
  const soloDepto = [...dHalladas].sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return soloDepto ? { depto: soloDepto[0], exacto: soloDepto[1] } : undefined;
}

function lugarDelDocumento(textos: string[], geo: Geografia, codigoDepto?: string): Hallazgo | undefined {
  // Fuera los encabezados del documento («REPÚBLICA DE GUATEMALA, CENTROAMÉRICA»…): contienen la palabra Guatemala pero no son un lugar.
  const lineas = lineasDe(textos).filter((l) => !/REPUBLICA|CENTROAMERICA|REGISTRO NACIONAL|DOCUMENTO PERSONAL|IDENTIFICACION/.test(norm(l)));
  // Las etiquetas salen mal con frecuencia («VECINDA(», «GAR DE NACIMIENTO»): se buscan por su raíz. La vecindad manda sobre el lugar de nacimiento.
  for (const etiqueta of [/VECIND/, /LUGAR DE NAC|NACIDO EN/]) {
    const ventanas = lineas.flatMap((l, i) => (etiqueta.test(norm(l)) ? [lineas.slice(i, i + 4).join(" ")] : []));
    for (const v of ventanas) { const r = elegirLugar(v, geo, codigoDepto); if (r?.muni) return { ...r, sinEtiqueta: false }; }
  }
  // Sin etiquetas legibles: una línea que SEA un departamento y, justo debajo, otra que sea un municipio de ese departamento. Se exige la línea
  // completa (no basta con contener la palabra): así el encabezado «REPÚBLICA DE GUATEMALA» no cuenta como lugar. Si hay dos bloques
  // (nacimiento y vecindad), el último es la vecindad porque en el documento va debajo del lugar de nacimiento.
  const esNombre = (l: string, nombre: string) => { const a = norm(l), n = norm(nombre); return a === n || (n.length >= 5 && lev(a, n) <= tolerancia(n.length)); };
  let ultimo: Hallazgo | undefined;
  for (let i = 0; i < lineas.length - 1; i++) {
    for (const d of Object.keys(geo)) {
      if (!esNombre(lineas[i]!, d)) continue;
      const m = geo[d]!.find((x) => esNombre(lineas[i + 1]!, x));
      if (m) ultimo = { depto: d, muni: m, exacto: norm(lineas[i]!) === norm(d) && norm(lineas[i + 1]!) === norm(m), sinEtiqueta: true };
    }
  }
  if (ultimo) return ultimo;
  for (const etiqueta of [/VECIND/, /LUGAR DE NAC|NACIDO EN/]) {   // al menos el departamento, si una etiqueta lo acompaña
    for (const [i, l] of lineas.entries()) if (etiqueta.test(norm(l))) { const r = elegirLugar(lineas.slice(i, i + 4).join(" "), geo, codigoDepto); if (r) return { ...r, sinEtiqueta: false }; }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------- candidatos a DPI en texto libre
function candidatosCui(textos: string[]): string[] {
  const vistos: string[] = [];
  for (const t of textos) {
    const crudo = t.toUpperCase();
    for (const m of aDigitos(crudo).matchAll(/(?<!\d)\d{4}[\s-]?\d{5}[\s-]?\d{4}(?!\d)/g)) {
      const original = crudo.slice(m.index ?? 0, (m.index ?? 0) + m[0].length);
      if ((original.match(/\d/g) ?? []).length < 9) continue;   // casi todo eran letras: no es un número
      vistos.push(m[0].replace(/\D/g, ""));
    }
  }
  return vistos;
}

// ---------------------------------------------------------------------------------------------------------------- resultado final
export function interpretarDpi(textos: string[], geo?: Geografia, hoy = new Date()): DpiLectura {
  const lineas = lineasDe(textos);
  const mrz = leerMrz(textos);
  const out: DpiLectura = {};

  // ---- DPI: el que pase el dígito verificador; si ninguno, el más repetido (o el de la MRZ) por revisar.
  const cands = [...(mrz.cui ? [mrz.cui] : []), ...candidatosCui(textos)];
  const cuenta = (c: string) => cands.filter((x) => x === c).length;
  const validos = [...new Set(cands)].filter((c) => validarCui(c).valido).sort((a, b) => cuenta(b) - cuenta(a));
  let cui: string | undefined;
  if (validos[0]) { cui = validos[0]; out.dpi = { valor: cui, estado: "verificado", nota: "El dígito verificador y el código de lugar son correctos." }; }
  else {
    const mejor = [...new Set(cands)].sort((a, b) => cuenta(b) - cuenta(a) || (b === mrz.cui ? 1 : 0) - (a === mrz.cui ? 1 : 0))[0];
    if (mejor) {
      const arreglado = repararCui(mejor);
      cui = arreglado ?? mejor;
      out.dpi = { valor: cui, estado: "revisar", nota: arreglado ? "Se corrigió un dígito mal leído con el dígito verificador. Confirme contra el documento." : `Puede estar mal leído: ${validarCui(mejor).motivo}. Confírmelo contra el documento.` };
    }
  }
  const cuiOk = cui ? validarCui(cui) : undefined;
  const deptoCui = cuiOk?.valido && cuiOk.departamentoCodigo ? departamentoDeCodigo(cuiOk.departamentoCodigo) : undefined;

  // ---- Nombre: frente (con tildes) y franja de lectura; la franja solo trae primer nombre y primer apellido, así que basta con que estén contenidos.
  let delFrente = nombreDelFrente(textos, mrz.piezasNombre);
  const delMrz = mrz.nombre;
  if (delFrente && mrz.piezasNombre?.[0]) {   // el nombre del frente empieza en el primer nombre de pila que da la franja: lo anterior es ruido del OCR
    const pal = delFrente.split(" "), primero = norm(mrz.piezasNombre[0]);
    const i = pal.findIndex((x) => lev(norm(x), primero) <= (primero.length >= 5 ? 1 : 0));
    if (i > 0) delFrente = pal.slice(i).join(" ");
  }
  const sim = delFrente && mrz.piezasNombre ? (() => {
    const f = norm(delFrente).split(" "), mm = mrz.piezasNombre.map(norm).filter((p) => p.length >= 2);
    return mm.length >= 2 && mm.every((p) => f.some((x) => lev(x, p) <= (p.length >= 5 ? 1 : 0)));
  })() : false;
  const nombre = delFrente ?? delMrz;
  if (nombre) out.nombreCompleto = { valor: tituloNombre(nombre), estado: sim ? "verificado" : "revisar", ...(sim ? {} : { nota: delFrente && delMrz ? "El frente y la franja de lectura no coinciden del todo; revise la ortografía." : delFrente ? "Se leyó solo del frente; revise la ortografía." : "Se leyó solo de la franja de lectura (sin tildes y quizá incompleto); complete el nombre." }) };

  // ---- Sexo: franja y frente; solo etiquetas explícitas o la palabra completa.
  const sF = sexoDelFrente(lineas), sM = mrz.sexo;
  if (sF && sM) out.sexo = { valor: sF, estado: sF === sM ? "verificado" : "revisar", ...(sF === sM ? {} : { nota: "El frente y la franja de lectura dicen cosas distintas." }) };
  else if (sM) out.sexo = { valor: sM, estado: mrz.nacimientoVerificado ? "verificado" : "revisar" };
  else if (sF) out.sexo = { valor: sF, estado: "revisar", nota: "Se leyó solo del frente." };

  // ---- Fecha de nacimiento: la de la franja, si su dígito de control cuadra, manda siempre (el frente puede traer letras por dígitos).
  const ff = fechaDelFrente(textos, hoy);
  if (mrz.nacimiento && mrz.nacimientoVerificado) {
    out.fechaNacimiento = { valor: mrz.nacimiento, estado: "verificado", ...(ff.fecha && ff.fecha !== mrz.nacimiento ? { nota: "Se tomó la fecha de la franja de lectura (con dígito de control); el frente se leyó distinto." } : {}) };
  } else if (mrz.nacimiento && (!ff.fecha || ff.fecha === mrz.nacimiento)) {
    out.fechaNacimiento = { valor: mrz.nacimiento, estado: ff.fecha === mrz.nacimiento && !ff.corregida ? "verificado" : "revisar" };
  } else if (ff.fecha) {
    out.fechaNacimiento = { valor: ff.fecha, estado: "revisar", nota: ff.corregida ? "El OCR confundió letras con números en la fecha; confírmela contra el documento." : mrz.nacimiento && mrz.nacimiento !== ff.fecha ? "El frente y la franja de lectura no coinciden." : "Se leyó solo del frente." };
  }

  // ---- Departamento y municipio: siempre contra el catálogo.
  if (geo) {
    const lugar = lugarDelDocumento(textos, geo, deptoCui);
    if (lugar?.depto) {
      const estado: Estado = lugar.exacto && !lugar.sinEtiqueta ? "verificado" : "revisar";
      const nota = lugar.sinEtiqueta ? "No se leyó la etiqueta: confirme que sea su vecindad y no el lugar de nacimiento." : undefined;
      out.departamento = { valor: lugar.depto, estado, ...(nota ? { nota } : {}) };
      if (lugar.muni) out.municipio = { valor: lugar.muni, estado, ...(nota ? { nota } : {}) };
    } else if (deptoCui && geo[deptoCui]) {
      out.departamento = { valor: deptoCui, estado: "revisar", nota: "Según el código del DPI (lugar de inscripción); elija el municipio." };
    }
  }
  return out;
}
