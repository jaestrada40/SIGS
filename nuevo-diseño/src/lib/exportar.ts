import { toast } from "sonner";
import { api } from "./api";

/** Genera un CSV (con BOM para Excel) y lo descarga en el navegador. */
export function aCSV<T>(filas: T[], columnas: { titulo: string; valor: (f: T) => string | number | null | undefined }[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.map((c) => esc(c.titulo)).join(","), ...filas.map((f) => columnas.map((c) => esc(c.valor(f))).join(","))];
  return lineas.join("\r\n") + "\r\n";
}

export function descargarCSV(contenido: string, nombre: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const fechaArchivo = () => new Date().toISOString().slice(0, 10);

/** Registra la exportación en la auditoría y, solo si quedó registrada, descarga el archivo. */
export async function exportarAuditado(recurso: Parameters<typeof api.registrarExportacion>[0], filas: number, contenido: string, nombre: string) {
  try {
    await api.registrarExportacion(recurso, filas);
  } catch {
    toast.error("No se pudo registrar la exportación en la auditoría. Intente de nuevo.");
    return;
  }
  descargarCSV(contenido, nombre);
}
