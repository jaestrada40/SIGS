// Lectura de CSV con coma o punto y coma, y conversión de fechas dd/mm/aaaa → aaaa-mm-dd.

export function detectarSeparador(primeraLinea: string): "," | ";" {
  const comas = (primeraLinea.match(/,/g) ?? []).length;
  const pyc = (primeraLinea.match(/;/g) ?? []).length;
  return pyc > comas ? ";" : ",";
}

export function parseCSV(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, "");
  const sep = detectarSeparador(limpio.split(/\r?\n/)[0] ?? "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda.trim()); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda.trim()); celda = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else celda += c;
  }
  fila.push(celda.trim());
  if (fila.some((x) => x !== "")) filas.push(fila);
  return filas;
}

/** Acepta dd/mm/aaaa, d/m/aaaa o aaaa-mm-dd. Devuelve aaaa-mm-dd o null si no es válida. */
export function normalizarFecha(v: string): string | null {
  const s = v.trim();
  let y: number, m: number, d: number;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dmy) { d = +dmy[1]!; m = +dmy[2]!; y = +dmy[3]!; }
  else if (ymd) { y = +ymd[1]!; m = +ymd[2]!; d = +ymd[3]!; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface Columna {
  clave: string;
  requerida?: boolean;
  tipo?: "fecha" | "hora" | "entero" | "texto";
  opciones?: string[];
}
export interface ErrorFila { fila: number; mensaje: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Convierte filas CSV a objetos. La fila 1 es el encabezado; los errores usan ese mismo número de fila. */
export function mapearFilas(tabla: string[][], columnas: Columna[], max = 1000): { filas: Record<string, string | number>[]; errores: ErrorFila[] } {
  const errores: ErrorFila[] = [];
  const [enc, ...datos] = tabla;
  if (!enc) return { filas: [], errores: [{ fila: 1, mensaje: "El archivo está vacío." }] };
  const idx = new Map(enc.map((h, i) => [norm(h), i]));
  for (const c of columnas) if (c.requerida && !idx.has(norm(c.clave))) errores.push({ fila: 1, mensaje: `Falta la columna obligatoria «${c.clave}».` });
  if (errores.length) return { filas: [], errores };
  if (datos.length === 0) return { filas: [], errores: [{ fila: 1, mensaje: "El archivo no tiene filas de datos." }] };
  if (datos.length > max) return { filas: [], errores: [{ fila: 1, mensaje: `El archivo tiene ${datos.length} filas; el máximo es ${max}.` }] };

  const filas = datos.map((r, i) => {
    const n = i + 2;
    const o: Record<string, string | number> = {};
    for (const c of columnas) {
      const j = idx.get(norm(c.clave));
      const v = j === undefined ? "" : (r[j] ?? "").trim();
      if (!v) { if (c.requerida) errores.push({ fila: n, mensaje: `«${c.clave}» es obligatorio.` }); continue; }
      if (c.tipo === "fecha") {
        const f = normalizarFecha(v);
        if (!f) errores.push({ fila: n, mensaje: `«${c.clave}» no es una fecha válida (use dd/mm/aaaa).` }); else o[c.clave] = f;
      } else if (c.tipo === "hora") {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) errores.push({ fila: n, mensaje: `«${c.clave}» debe tener formato HH:MM.` }); else o[c.clave] = v;
      } else if (c.tipo === "entero") {
        if (!/^\d+$/.test(v)) errores.push({ fila: n, mensaje: `«${c.clave}» debe ser un número entero mayor o igual a 0.` }); else o[c.clave] = Number(v);
      } else if (c.opciones) {
        const up = v.toUpperCase();
        if (!c.opciones.includes(up)) errores.push({ fila: n, mensaje: `«${c.clave}» debe ser ${c.opciones.join(", ")}.` }); else o[c.clave] = up;
      } else o[c.clave] = v;
    }
    return o;
  });
  return { filas, errores };
}

export function plantillaCSV(columnas: Columna[], ejemplo: string[]): string {
  return `${columnas.map((c) => c.clave).join(",")}\n${ejemplo.join(",")}\n`;
}
