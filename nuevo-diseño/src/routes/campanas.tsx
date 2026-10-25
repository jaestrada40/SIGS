import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, CalendarDays, Download, HeartPulse, Loader2, MapPin, Plus, Ribbon, Sparkles, Users, Wind } from "lucide-react";
import { DifusionDialog } from "@/components/sisg/DifusionDialog";
import { aCSV, exportarAuditado, fechaArchivo } from "@/lib/exportar";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { Card, EmptyState, Field, FilterChip, IconChip, inputCls, PageHeader, Skeleton, Tag, toneColor, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError, esCentro, fmtFecha, fmtNum, puedeEscribir, useSession, type AreaCampana, type Campana, type EstadoCampana } from "@/lib/api";

export const Route = createFileRoute("/campanas")({
  head: () => ({
    meta: [
      { title: "Campañas · SISG Grupo 4" },
      { name: "description", content: "Campañas de salud y personas atendidas." },
      { property: "og:title", content: "Campañas · SISG Grupo 4" },
      { property: "og:description", content: "Campañas de salud y personas atendidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Campanas /></AppShell>,
});

const AREAS: Record<AreaCampana, { label: string; icon: typeof HeartPulse; tone: Tono }> = {
  CARDIOVASCULAR: { label: "Cardiovascular", icon: HeartPulse, tone: "coral" },
  RESPIRATORIA: { label: "Respiratoria", icon: Wind, tone: "blue" },
  PLANIFICACION: { label: "Planificación familiar", icon: Baby, tone: "teal" },
  ONCOLOGICO_OTRO: { label: "Oncológico u otro", icon: Ribbon, tone: "amber" },
};
const ESTADOS: Record<EstadoCampana, { label: string; tone: Tono }> = {
  PROGRAMADA: { label: "Programada", tone: "blue" },
  EN_CURSO: { label: "En curso", tone: "amber" },
  FINALIZADA: { label: "Finalizada", tone: "teal" },
};

function Campanas() {
  const session = useSession();
  const org = !esCentro(session?.entidad);
  const q = useQuery({ queryKey: ["campanas"], queryFn: api.campanas, enabled: org });
  const [estado, setEstado] = useState<EstadoCampana | "">("");
  const [sel, setSel] = useState<Campana | "nuevo" | null>(null);
  const [difusion, setDifusion] = useState<{ open: boolean; c: Campana | null }>({ open: false, c: null });

  if (!org) return <Card><EmptyState title="Sección solo para organismos no lucrativos" text="Los centros de diagnóstico registran estudios en lugar de campañas." /></Card>;

  const lista = q.data ?? [];
  const max = Math.max(1, ...lista.map((c) => c.personasAtendidas ?? 0));
  const total = lista.reduce((s, c) => s + (c.personasAtendidas ?? 0), 0);
  const filtradas = lista.filter((c) => !estado || c.estado === estado);

  return (
    <>
      <PageHeader title="Campañas" subtitle={q.data ? `${fmtNum(lista.length)} campañas · ${fmtNum(total)} personas atendidas` : "Organice jornadas de salud y registre su avance."}
        actions={<>
          <Button variant="outline" disabled={!filtradas.length} onClick={() => exportarAuditado("campana", filtradas.length, aCSV(filtradas, [
            { titulo: "nombre", valor: (c) => c.nombre }, { titulo: "area", valor: (c) => c.area }, { titulo: "fechaInicio", valor: (c) => c.fechaInicio },
            { titulo: "fechaFin", valor: (c) => c.fechaFin }, { titulo: "departamento", valor: (c) => c.departamento }, { titulo: "ubicacion", valor: (c) => c.ubicacion },
            { titulo: "personasAtendidas", valor: (c) => c.personasAtendidas }, { titulo: "estado", valor: (c) => c.estado },
          ]), `campanas_${fechaArchivo()}.csv`)}><Download /> Exportar CSV</Button>
          {puedeEscribir(session) && <Button variant="outline" onClick={() => setDifusion({ open: true, c: null })}><Sparkles /> Mensajes con IA</Button>}
          {puedeEscribir(session) && <Button onClick={() => setSel("nuevo")}><Plus /> Nueva campaña</Button>}
        </>} />

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip active={!estado} onClick={() => setEstado("")}>Todas</FilterChip>
        {(Object.keys(ESTADOS) as EstadoCampana[]).map((k) => <FilterChip key={k} active={estado === k} onClick={() => setEstado(estado === k ? "" : k)}>{ESTADOS[k].label}</FilterChip>)}
      </div>

      {q.isLoading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>}
      {q.isError && <Card><EmptyState error title="No pudimos cargar las campañas" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} /></Card>}
      {q.data && lista.length === 0 && <Card><EmptyState title="Aún no hay campañas" text="Registre su primera jornada de salud." action={<Button onClick={() => setSel("nuevo")}><Plus /> Nueva campaña</Button>} /></Card>}
      {q.data && lista.length > 0 && filtradas.length === 0 && <Card><EmptyState title="Sin resultados" text="No hay campañas con ese estado." /></Card>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtradas.map((c) => {
          const a = AREAS[c.area] ?? AREAS.ONCOLOGICO_OTRO;
          const e = c.estado ? ESTADOS[c.estado] : null;
          const n = c.personasAtendidas ?? 0;
          return (
            <button key={c.id} onClick={() => setSel(c)} className="surface lift flex flex-col gap-4 p-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <IconChip icon={a.icon} tone={a.tone} size="lg" />
                {e && <Tag tone={e.tone}>{e.label}</Tag>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.label}</p>
                <h2 className="mt-1 text-lg font-bold leading-snug">{c.nombre}</h2>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden />{[c.ubicacion, c.departamento].filter(Boolean).join(", ") || "Sin lugar definido"}</p>
                <p className="flex items-center gap-2 tabular"><CalendarDays className="h-4 w-4" aria-hidden />{fmtFecha(c.fechaInicio)}{c.fechaFin ? ` – ${fmtFecha(c.fechaFin)}` : ""}</p>
              </div>
              <div className="mt-auto">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-semibold"><Users className="h-4 w-4" aria-hidden /> Personas atendidas</span>
                  <span className="font-display font-extrabold tabular">{fmtNum(n)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={max} aria-label={`${fmtNum(n)} personas atendidas`}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(n / max) * 100}%`, background: toneColor(a.tone) }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {lista.length > 0 && <p className="mt-3 text-xs text-muted-foreground">La barra compara cada campaña con la que más personas ha atendido.</p>}

      <CampanaSheet sel={sel} onClose={() => setSel(null)} onDifusion={(c) => { setSel(null); setDifusion({ open: true, c }); }} />
      <DifusionDialog open={difusion.open} onOpenChange={(o) => setDifusion((d) => ({ ...d, open: o }))} campanas={lista} inicial={difusion.c} />
    </>
  );
}

function CampanaSheet({ sel, onClose, onDifusion }: { sel: Campana | "nuevo" | null; onClose: () => void; onDifusion: (c: Campana) => void }) {
  const qc = useQueryClient();
  const c = sel && sel !== "nuevo" ? sel : null;
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (b: Omit<Campana, "id">) => (c ? api.editarCampana(c.id, b) : api.crearCampana(b)),
    onSuccess: () => { toast.success(c ? "Campaña actualizada" : "Campaña registrada"); void qc.invalidateQueries(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : "No se pudo guardar."),
  });

  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault(); setError(null);
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    if (!g("nombre") || !g("fechaInicio")) { setError("Nombre, área y fecha de inicio son obligatorios."); return; }
    const pa = g("personasAtendidas");
    if (pa && !/^\d+$/.test(pa)) { setError("Personas atendidas debe ser un número entero mayor o igual a 0."); return; }
    if (g("fechaFin") && g("fechaFin") < g("fechaInicio")) { setError("La fecha de fin no puede ser antes del inicio."); return; }
    const b: Omit<Campana, "id"> = { nombre: g("nombre"), area: g("area") as AreaCampana, fechaInicio: g("fechaInicio"), estado: g("estado") as EstadoCampana, personasAtendidas: pa ? Number(pa) : 0 };
    for (const k of ["fechaFin", "departamento", "ubicacion"] as const) { const v = g(k); if (v) b[k] = v; }
    m.mutate(b);
  }

  return (
    <Sheet open={sel !== null} onOpenChange={(o) => { if (!o) { setError(null); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">{c ? c.nombre : "Nueva campaña"}</SheetTitle>
          <SheetDescription>{c ? "Actualice el avance de la campaña." : "Los campos con * son obligatorios."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-6 space-y-4" key={c?.id ?? "nuevo"}>
          <Field id="nombre" label="Nombre" required><input id="nombre" name="nombre" required defaultValue={c?.nombre} className={inputCls} /></Field>
          <Field id="area" label="Área" required>
            <select id="area" name="area" defaultValue={c?.area ?? "CARDIOVASCULAR"} className={inputCls}>
              {(Object.keys(AREAS) as AreaCampana[]).map((k) => <option key={k} value={k}>{AREAS[k].label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fechaInicio" label="Inicio" required><input id="fechaInicio" name="fechaInicio" type="date" required defaultValue={c?.fechaInicio} className={inputCls} /></Field>
            <Field id="fechaFin" label="Fin"><input id="fechaFin" name="fechaFin" type="date" defaultValue={c?.fechaFin ?? ""} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="departamento" label="Departamento"><input id="departamento" name="departamento" defaultValue={c?.departamento ?? ""} className={inputCls} /></Field>
            <Field id="ubicacion" label="Lugar"><input id="ubicacion" name="ubicacion" defaultValue={c?.ubicacion ?? ""} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="personasAtendidas" label="Personas atendidas"><input id="personasAtendidas" name="personasAtendidas" type="number" min={0} step={1} defaultValue={c?.personasAtendidas ?? 0} className={inputCls} /></Field>
            <Field id="estado" label="Estado">
              <select id="estado" name="estado" defaultValue={c?.estado ?? "PROGRAMADA"} className={inputCls}>
                {(Object.keys(ESTADOS) as EstadoCampana[]).map((k) => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
              </select>
            </Field>
          </div>
          {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {c && <Button type="button" variant="secondary" className="mr-auto" onClick={() => onDifusion(c)}><Sparkles /> Redactar difusión</Button>}
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Guardar</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
