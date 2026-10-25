import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Download, FileSpreadsheet, FlaskConical, Loader2, Plus, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { ImportDialog } from "@/components/sisg/ImportDialog";
import { OcrDpi } from "@/components/sisg/OcrDpiDialog";
import { Card, EmptyState, Field, FilterChip, IconChip, inputCls, ListSkeleton, PageHeader, Tag, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError, esCentro, fmtFecha, fmtNum, puedeEscribir, useSession, type Estudio, type Paciente } from "@/lib/api";
import type { Columna } from "@/lib/csv";
import { aCSV, exportarAuditado, fechaArchivo } from "@/lib/exportar";

export const Route = createFileRoute("/estudios")({
  head: () => ({
    meta: [
      { title: "Estudios · SISG Grupo 4" },
      { name: "description", content: "Estudios diagnósticos programados y realizados." },
      { property: "og:title", content: "Estudios · SISG Grupo 4" },
      { property: "og:description", content: "Estudios diagnósticos programados y realizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Estudios /></AppShell>,
});

const ESTADOS: Record<string, { label: string; tone: Tono; icon: typeof CheckCircle2 }> = {
  PROGRAMADO: { label: "Programado", tone: "blue", icon: CalendarClock },
  REALIZADO: { label: "Realizado", tone: "teal", icon: CheckCircle2 },
  CANCELADO: { label: "Cancelado", tone: "coral", icon: XCircle },
};
const COLUMNAS: Columna[] = [
  { clave: "dpi", requerida: true }, { clave: "tipoEstudio", requerida: true }, { clave: "fecha", requerida: true, tipo: "fecha" },
  { clave: "hora", tipo: "hora" }, { clave: "salaEquipo" }, { clave: "especialista" },
  { clave: "estado", opciones: Object.keys(ESTADOS) }, { clave: "resultado" },
];

function Estudios() {
  const session = useSession();
  const qc = useQueryClient();
  const centro = esCentro(session?.entidad);
  const q = useQuery({ queryKey: ["estudios"], queryFn: api.estudios, enabled: centro });
  const pq = useQuery({ queryKey: ["pacientes"], queryFn: api.pacientes, enabled: centro });
  const [estado, setEstado] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Estudio | "nuevo" | null>(null);
  const [importar, setImportar] = useState(false);

  if (!centro) return <Card><EmptyState title="Sección solo para centros de diagnóstico" text="Los organismos no lucrativos registran campañas en lugar de estudios." /></Card>;

  const pacientes = new Map((pq.data ?? []).map((p) => [String(p.id), p]));
  const lista = [...(q.data ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const conteo = (k: string) => lista.filter((e) => e.estado === k).length;
  const filtrados = lista.filter((e) => {
    const t = busca.trim().toLowerCase();
    const nombre = pacientes.get(String(e.pacienteId))?.nombreCompleto.toLowerCase() ?? "";
    return (!estado || e.estado === estado) && (!t || e.tipoEstudio.toLowerCase().includes(t) || nombre.includes(t));
  });

  return (
    <>
      <PageHeader title="Estudios" subtitle="Programe estudios diagnósticos y registre sus resultados."
        actions={<>
          <Button variant="outline" disabled={!filtrados.length} onClick={() => exportarAuditado("estudio", filtrados.length, aCSV(filtrados, [
            { titulo: "paciente", valor: (e) => pacientes.get(String(e.pacienteId))?.nombreCompleto }, { titulo: "dpi", valor: (e) => pacientes.get(String(e.pacienteId))?.dpi },
            { titulo: "tipoEstudio", valor: (e) => e.tipoEstudio }, { titulo: "fecha", valor: (e) => e.fecha }, { titulo: "hora", valor: (e) => e.hora },
            { titulo: "salaEquipo", valor: (e) => e.salaEquipo }, { titulo: "especialista", valor: (e) => e.especialista }, { titulo: "estado", valor: (e) => e.estado }, { titulo: "resultado", valor: (e) => e.resultado },
          ]), `estudios_${fechaArchivo()}.csv`)}><Download /> Exportar CSV</Button>
          {puedeEscribir(session) && <Button variant="outline" onClick={() => setImportar(true)}><FileSpreadsheet /> Importar por DPI</Button>}
          {puedeEscribir(session) && <Button onClick={() => setSel("nuevo")}><Plus /> Nuevo estudio</Button>}
        </>} />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {Object.entries(ESTADOS).map(([k, v]) => (
          <Card key={k} className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <IconChip icon={v.icon} tone={v.tone} />
            <div className="min-w-0"><p className="font-display text-2xl font-extrabold tabular">{fmtNum(conteo(k))}</p><p className="text-xs font-medium text-muted-foreground">{v.label}s</p></div>
          </Card>
        ))}
      </div>

      <Card className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar estudio o paciente" placeholder="Buscar por estudio o paciente…" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!estado} onClick={() => setEstado("")}>Todos</FilterChip>
          {Object.entries(ESTADOS).map(([k, v]) => <FilterChip key={k} active={estado === k} onClick={() => setEstado(estado === k ? "" : k)}>{v.label}</FilterChip>)}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {q.isLoading && <div className="p-5"><ListSkeleton /></div>}
        {q.isError && <EmptyState error title="No pudimos cargar los estudios" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && lista.length === 0 && <EmptyState title="Aún no hay estudios" text="Programe el primero para uno de sus pacientes." action={<Button onClick={() => setSel("nuevo")}><Plus /> Nuevo estudio</Button>} />}
        {q.data && lista.length > 0 && filtrados.length === 0 && <EmptyState title="Sin resultados" text="Ningún estudio coincide con los filtros." />}
        {filtrados.length > 0 && (
          <ul className="divide-y">
            {filtrados.map((e) => {
              const est = ESTADOS[e.estado ?? ""];
              return (
                <li key={e.id}>
                  <button onClick={() => setSel(e)} className="flex w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-accent/50 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-5">
                    {/* En móvil: icono y nombre arriba; fecha y estado debajo. Desde sm: todo en una sola fila. */}
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <IconChip icon={FlaskConical} tone="blue" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold">{e.tipoEstudio}</p>
                        <p className="truncate text-sm text-muted-foreground">{pacientes.get(String(e.pacienteId))?.nombreCompleto ?? "Paciente"}{e.especialista ? ` · ${e.especialista}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:contents sm:pl-0">
                      <p className="text-sm tabular text-muted-foreground">{fmtFecha(e.fecha)}{e.hora ? ` · ${e.hora.slice(0, 5)}` : ""}</p>
                      {est ? <Tag tone={est.tone}>{est.label}</Tag> : <Tag tone="amber">Sin estado</Tag>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <EstudioSheet sel={sel} pacientes={pq.data ?? []} onClose={() => setSel(null)} />
      <ImportDialog open={importar} onOpenChange={setImportar} titulo="Importar estudios por DPI" columnas={COLUMNAS}
        ejemplo={["2547896320101", "Hematología completa", "15/10/2026", "08:30", "Laboratorio 1", "Dra. Pérez", "PROGRAMADO", ""]}
        nombrePlantilla="plantilla_estudios.csv" onImport={(f) => api.importarEstudios(f)}
        onDone={(n) => { toast.success(`${fmtNum(n)} estudios importados`); void qc.invalidateQueries(); }} />
    </>
  );
}

function EstudioSheet({ sel, pacientes, onClose }: { sel: Estudio | "nuevo" | null; pacientes: Paciente[]; onClose: () => void }) {
  const qc = useQueryClient();
  const e = sel && sel !== "nuevo" ? sel : null;
  const [filtro, setFiltro] = useState("");
  const [pacienteId, setPacienteId] = useState(e ? String(e.pacienteId) : "");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (b: Omit<Estudio, "id">) => (e ? api.editarEstudio(e.id, b) : api.crearEstudio(b)),
    onSuccess: () => { toast.success(e ? "Estudio actualizado" : "Estudio programado"); void qc.invalidateQueries(); onClose(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo guardar."),
  });
  const opciones = pacientes.filter((p) => !filtro || p.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) || (p.dpi ?? "").includes(filtro));

  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault(); setError(null);
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const pid = g("pacienteId");
    if (!pid || !g("tipoEstudio") || !g("fecha")) { setError("Paciente, tipo de estudio y fecha son obligatorios."); return; }
    const b: Omit<Estudio, "id"> = { pacienteId: isNaN(Number(pid)) ? pid : Number(pid), tipoEstudio: g("tipoEstudio"), fecha: g("fecha") };
    for (const k of ["hora", "salaEquipo", "especialista", "estado", "resultado"] as const) { const v = g(k); if (v) b[k] = v; }
    m.mutate(b);
  }

  return (
    <Sheet open={sel !== null} onOpenChange={(o) => { if (!o) { setError(null); setFiltro(""); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">{e ? e.tipoEstudio : "Nuevo estudio"}</SheetTitle>
          <SheetDescription>{e ? "Actualice el estado o registre el resultado." : "Los campos con * son obligatorios."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-6 space-y-4" key={e?.id ?? "nuevo"}>
          <Field id="pacienteId" label="Paciente" required>
            <input type="search" value={filtro} onChange={(x) => setFiltro(x.target.value)} placeholder="Buscar paciente por nombre o DPI…" aria-label="Buscar paciente" className={`${inputCls} mb-2`} />
            <OcrDpi onFound={(dpi) => { setFiltro(dpi); const p = pacientes.find((x) => x.dpi === dpi); if (p) setPacienteId(String(p.id)); }} />
            <select id="pacienteId" name="pacienteId" required value={pacienteId} onChange={(x) => setPacienteId(x.target.value)} className={`${inputCls} py-1`} style={{ height: "auto" }} size={Math.min(5, Math.max(2, opciones.length + 1))}>
              <option value="" disabled>Seleccione un paciente</option>
              {opciones.map((p) => <option key={p.id} value={String(p.id)}>{p.nombreCompleto}{p.dpi ? ` · ${p.dpi}` : ""}</option>)}
            </select>
          </Field>
          <Field id="tipoEstudio" label="Tipo de estudio" required><input id="tipoEstudio" name="tipoEstudio" required defaultValue={e?.tipoEstudio} placeholder="Ej. Rayos X de tórax" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fecha" label="Fecha" required><input id="fecha" name="fecha" type="date" required defaultValue={e?.fecha} className={inputCls} /></Field>
            <Field id="hora" label="Hora"><input id="hora" name="hora" type="time" defaultValue={e?.hora?.slice(0, 5) ?? ""} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="salaEquipo" label="Sala o equipo"><input id="salaEquipo" name="salaEquipo" defaultValue={e?.salaEquipo ?? ""} className={inputCls} /></Field>
            <Field id="especialista" label="Especialista"><input id="especialista" name="especialista" defaultValue={e?.especialista ?? ""} className={inputCls} /></Field>
          </div>
          <Field id="estado" label="Estado">
            <select id="estado" name="estado" defaultValue={e?.estado ?? "PROGRAMADO"} className={inputCls}>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field id="resultado" label="Resultado"><textarea id="resultado" name="resultado" rows={3} defaultValue={e?.resultado ?? ""} className={`${inputCls} h-auto py-2`} /></Field>
          {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Guardar</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
