import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mapearFilas, parseCSV, plantillaCSV, type Columna, type ErrorFila } from "@/lib/csv";
import { ApiError, fmtNum } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  columnas: Columna[];
  ejemplo: string[];
  nombrePlantilla: string;
  onImport: (filas: Record<string, string | number>[]) => Promise<{ importados: number }>;
  onDone: (n: number) => void;
}

export function ImportDialog({ open, onOpenChange, titulo, columnas, ejemplo, nombrePlantilla, onImport, onDone }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<Record<string, string | number>[]>([]);
  const [errores, setErrores] = useState<ErrorFila[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function reset() { setArchivo(null); setFilas([]); setErrores([]); setMsg(null); }

  async function leer(f: File) {
    reset();
    if (!/\.csv$/i.test(f.name)) { setArchivo(f.name); setErrores([{ fila: 1, mensaje: "El archivo debe ser .csv" }]); return; }
    setArchivo(f.name);
    const r = mapearFilas(parseCSV(await f.text()), columnas);
    setFilas(r.filas); setErrores(r.errores);
  }

  async function importar() {
    setEnviando(true); setMsg(null);
    try {
      const r = await onImport(filas);
      onDone(r.importados); reset(); onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.errores?.length) setErrores(e.errores);
      setMsg(e instanceof Error ? e.message : "No se pudo importar.");
    } finally { setEnviando(false); }
  }

  function descargar() {
    const url = URL.createObjectURL(new Blob([plantillaCSV(columnas, ejemplo)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = nombrePlantilla; a.click(); URL.revokeObjectURL(url);
  }

  const claves = columnas.map((c) => c.clave);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{titulo}</DialogTitle>
          <DialogDescription>Hasta 1,000 filas. Se aceptan coma o punto y coma, y fechas dd/mm/aaaa. Si una fila tiene error, no se importa ninguna.</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void leer(f); }}
          className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors", drag ? "border-primary bg-accent" : "border-border bg-muted/50 hover:bg-accent")}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-soft text-teal"><UploadCloud className="h-6 w-6" aria-hidden /></span>
          <span className="font-semibold">{archivo ?? "Arrastre su archivo CSV aquí"}</span>
          <span className="text-sm text-muted-foreground">o haga clic para elegirlo</span>
        </button>
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Archivo CSV"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void leer(f); e.target.value = ""; }} />

        <button type="button" onClick={descargar} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline">
          <Download className="h-4 w-4" aria-hidden /> Descargar plantilla
        </button>

        {errores.length > 0 && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-coral-soft p-4">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" aria-hidden /> {fmtNum(errores.length)} {errores.length === 1 ? "error encontrado" : "errores encontrados"}. Corríjalos y vuelva a subir el archivo.</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {errores.map((e, i) => <li key={i}><strong>Fila {e.fila}:</strong> {e.mensaje}</li>)}
            </ul>
          </div>
        )}
        {msg && errores.length === 0 && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{msg}</p>}

        {filas.length > 0 && errores.length === 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {fmtNum(filas.length)} filas listas. Vista previa:</p>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted"><tr>{claves.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">{c}</th>)}</tr></thead>
                <tbody>{filas.slice(0, 5).map((f, i) => <tr key={i} className="border-t">{claves.map((c) => <td key={c} className="whitespace-nowrap px-3 py-2">{String(f[c] ?? "—")}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={enviando || filas.length === 0 || errores.length > 0}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />} Importar {filas.length > 0 && fmtNum(filas.length)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
