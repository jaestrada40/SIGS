import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Clock, Loader2, Plus, Search, Send, UserX, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { Card, EmptyState, Field, FilterChip, IconChip, inputCls, ListSkeleton, PageHeader, Tag, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError, esCentro, fmtFecha, puedeEscribir, tiempoRelativo, useSession, type EstadoReferido, type Referido } from "@/lib/api";

export const Route = createFileRoute("/referidos")({
  head: () => ({
    meta: [
      { title: "Referidos · SISG Grupo 4" },
      { name: "description", content: "Personas que un organismo envía a un centro de diagnóstico y cómo avanzan." },
      { property: "og:title", content: "Referidos · SISG Grupo 4" },
      { property: "og:description", content: "Personas que un organismo envía a un centro de diagnóstico y cómo avanzan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Referidos /></AppShell>,
});

const ESTADOS: Record<EstadoReferido, { label: string; tone: Tono; icon: typeof Clock }> = {
  PENDIENTE: { label: "Pendiente", tone: "blue", icon: Clock },
  AGENDADO: { label: "Agendado", tone: "amber", icon: CalendarCheck },
  ATENDIDO: { label: "Atendido", tone: "teal", icon: CheckCircle2 },
  NO_LLEGO: { label: "No llegó", tone: "coral", icon: UserX },
  CANCELADO: { label: "Cancelado", tone: "coral", icon: XCircle },
};
const ESTUDIOS_COMUNES = ["Mamografía", "Ultrasonido mamario", "Papanicolaou", "Rayos X de tórax", "Electrocardiograma", "Espirometría", "Hematología completa", "Ultrasonido abdominal"];
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");
const dpiBonito = (d: string) => (d.length === 13 ? `${d.slice(0, 4)} ${d.slice(4, 9)} ${d.slice(9)}` : d);

function Referidos() {
  const session = useSession()!;
  const qc = useQueryClient();
  const centro = esCentro(session.entidad), escribe = puedeEscribir(session);
  const q = useQuery({ queryKey: ["referidos"], queryFn: api.referidos });
  const [estado, setEstado] = useState<EstadoReferido | "">("");
  const [busca, setBusca] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [agendando, setAgendando] = useState<Referido | null>(null);
  const [confirmar, setConfirmar] = useState<{ r: Referido; accion: "no-llego" | "cancelar" } | null>(null);

  const lista = q.data ?? [];
  const cuenta = (e: EstadoReferido) => lista.filter((r) => r.estado === e).length;
  const cerrados = cuenta("ATENDIDO") + cuenta("NO_LLEGO");
  const filtrados = lista.filter((r) => {
    const t = busca.trim().toLowerCase();
    return (!estado || r.estado === estado) && (!t || r.nombreCompleto.toLowerCase().includes(t) || (r.dpi ?? "").includes(t) || r.codigo.toLowerCase().includes(t) || r.tipoEstudio.toLowerCase().includes(t));
  });

  const cerrar = useMutation({
    mutationFn: ({ r, accion }: { r: Referido; accion: "no-llego" | "cancelar" }) => (accion === "cancelar" ? api.cancelarReferido(r.id) : api.noLlegoReferido(r.id)),
    onSuccess: (_, { accion }) => { toast.success(accion === "cancelar" ? "Referido cancelado" : "Marcado como «no llegó»"); void qc.invalidateQueries(); setConfirmar(null); },
    onError: (e) => { toast.error(msg(e)); setConfirmar(null); },
  });

  return (
    <>
      <PageHeader title="Referidos"
        subtitle={centro ? "Personas que los organismos le envían para un estudio." : "Personas que usted envía a un centro de diagnóstico y cómo avanzan."}
        actions={!centro && escribe ? <Button onClick={() => setNuevo(true)}><Plus /> Nuevo referido</Button> : undefined} />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {(["PENDIENTE", "AGENDADO", "ATENDIDO", "NO_LLEGO"] as const).map((k) => {
          const e = ESTADOS[k];
          return (
            <Card key={k} className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <IconChip icon={e.icon} tone={e.tone} />
              <div className="min-w-0"><p className="font-display text-2xl font-extrabold tabular">{cuenta(k)}</p><p className="text-xs font-medium text-muted-foreground">{e.label}{k === "ATENDIDO" || k === "NO_LLEGO" ? "s" : "s"}</p></div>
            </Card>
          );
        })}
      </div>
      {cerrados > 0 && <p className="mb-4 text-sm text-muted-foreground">De las personas con resultado final, <strong className="text-foreground">{Math.round((100 * cuenta("ATENDIDO")) / cerrados)}%</strong> llegó al estudio.</p>}

      <Card className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar referido" placeholder="Buscar por nombre, DPI, estudio o código…" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!estado} onClick={() => setEstado("")}>Todos</FilterChip>
          {(Object.keys(ESTADOS) as EstadoReferido[]).map((k) => <FilterChip key={k} active={estado === k} onClick={() => setEstado(estado === k ? "" : k)}>{ESTADOS[k].label}</FilterChip>)}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {q.isLoading && <div className="p-5"><ListSkeleton /></div>}
        {q.isError && <EmptyState error title="No pudimos cargar los referidos" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && lista.length === 0 && (
          <EmptyState title={centro ? "Aún no le han enviado a nadie" : "Aún no ha enviado a nadie"}
            text={centro ? "Cuando un organismo refiera a una persona a su centro, aparecerá aquí con su código." : "Desde una campaña puede referir a una persona a un centro de diagnóstico y ver si llegó."}
            action={!centro && escribe ? <Button onClick={() => setNuevo(true)}><Plus /> Nuevo referido</Button> : undefined} />
        )}
        {q.data && lista.length > 0 && filtrados.length === 0 && <EmptyState title="Sin resultados" text="Ningún referido coincide con los filtros." />}
        {filtrados.length > 0 && (
          <ul className="divide-y">
            {filtrados.map((r) => {
              const e = ESTADOS[r.estado];
              return (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    <IconChip icon={Send} tone="blue" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">{r.nombreCompleto}</p>
                      <p className="text-sm text-muted-foreground">{r.tipoEstudio} · {centro ? "envía" : "para"} {r.contraparte}</p>
                      {centro && (r.dpi || r.telefono) && <p className="text-xs text-muted-foreground">{r.dpi && `DPI ${dpiBonito(r.dpi)}`}{r.dpi && r.telefono && " · "}{r.telefono && `Tel. ${r.telefono}`}</p>}
                      <p className="text-xs text-muted-foreground">Código <span className="font-mono font-semibold text-foreground">{r.codigo}</span> · {tiempoRelativo(r.creadoEn)}{r.fechaCita ? ` · cita ${fmtFecha(r.fechaCita)}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[3.25rem] sm:pl-0">
                    <Tag tone={e.tone}>{e.label}</Tag>
                    {escribe && centro && r.estado === "PENDIENTE" && <Button size="sm" onClick={() => setAgendando(r)}><CalendarCheck /> Agendar</Button>}
                    {escribe && centro && (r.estado === "PENDIENTE" || r.estado === "AGENDADO") && <Button size="sm" variant="outline" onClick={() => setConfirmar({ r, accion: "no-llego" })}>No llegó</Button>}
                    {escribe && !centro && r.estado === "PENDIENTE" && <Button size="sm" variant="outline" onClick={() => setConfirmar({ r, accion: "cancelar" })}>Cancelar</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <NuevoReferido open={nuevo} onClose={() => setNuevo(false)} />
      <AgendarDialog r={agendando} onClose={() => setAgendando(null)} />
      <AlertDialog open={!!confirmar} onOpenChange={(o) => { if (!o) setConfirmar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.accion === "cancelar" ? "¿Cancelar este referido?" : "¿Marcar que la persona no llegó?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.accion === "cancelar" ? `Se retira el referido de ${confirmar.r.nombreCompleto}. El centro ya no lo verá como pendiente.` : confirmar ? `Se cierra el referido de ${confirmar.r.nombreCompleto}. El organismo verá que no llegó al estudio.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={(ev) => { ev.preventDefault(); if (confirmar) cerrar.mutate(confirmar); }} disabled={cerrar.isPending}>{cerrar.isPending && <Loader2 className="animate-spin" />} Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AgendarDialog({ r, onClose }: { r: Referido | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (b: { fecha: string; hora?: string | undefined }) => api.agendarReferido(r!.id, b),
    onSuccess: () => { toast.success("Estudio agendado. Ya aparece en Estudios."); void qc.invalidateQueries(); onClose(); },
    onError: (e) => setError(msg(e)),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    const fecha = String(fd.get("fecha") ?? ""), hora = String(fd.get("hora") ?? "");
    if (!fecha) { setError("Elija la fecha del estudio."); return; }
    m.mutate({ fecha, hora: hora || undefined });
  }
  return (
    <Dialog open={!!r} onOpenChange={(o) => { if (!o) { setError(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        {r && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Agendar estudio</DialogTitle>
              <DialogDescription>{r.nombreCompleto} · {r.tipoEstudio}. Se registra a la persona en su centro y se programa el estudio.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3" key={r.id}>
              <div className="grid grid-cols-2 gap-3">
                <Field id="fecha" label="Fecha" required><input id="fecha" name="fecha" type="date" required min={new Date().toISOString().slice(0, 10)} className={inputCls} /></Field>
                <Field id="hora" label="Hora"><input id="hora" name="hora" type="time" className={inputCls} /></Field>
              </div>
              {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Agendar</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NuevoReferido({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const pacientes = useQuery({ queryKey: ["pacientes"], queryFn: api.pacientes, enabled: open });
  const campanas = useQuery({ queryKey: ["campanas"], queryFn: api.campanas, enabled: open });
  const centros = useQuery({ queryKey: ["centros-referencia"], queryFn: api.centrosReferencia, enabled: open });
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: api.crearReferido,
    onSuccess: (r) => { toast.success(`Referido enviado. Código ${r.codigo}`); void qc.invalidateQueries(); setFiltro(""); onClose(); },
    onError: (e) => setError(msg(e)),
  });
  const t = filtro.trim().toLowerCase();
  const opciones = (pacientes.data ?? []).filter((p) => !t || p.nombreCompleto.toLowerCase().includes(t) || (p.dpi ?? "").includes(t));

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    if (!g("pacienteId")) { setError("Elija a la persona que va a referir."); return; }
    if (!g("centroId")) { setError("Elija el centro de diagnóstico."); return; }
    if (!g("tipoEstudio")) { setError("Escriba el estudio que necesita."); return; }
    if (fd.get("consentimiento") !== "on") { setError("Confirme que la persona autorizó compartir sus datos con el centro."); return; }
    m.mutate({ pacienteId: Number(g("pacienteId")), ...(g("campanaId") ? { campanaId: Number(g("campanaId")) } : {}), centroId: Number(g("centroId")), tipoEstudio: g("tipoEstudio"), ...(g("motivo") ? { motivo: g("motivo") } : {}), consentimiento: true });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setError(null); setFiltro(""); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Nuevo referido</SheetTitle>
          <SheetDescription>Envíe a una persona a un centro de diagnóstico. Podrá ver si llegó, no su resultado.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field id="pacienteId" label="Persona" required>
            <input type="search" value={filtro} onChange={(x) => setFiltro(x.target.value)} placeholder="Buscar por nombre o DPI…" aria-label="Buscar persona" className={`${inputCls} mb-2`} />
            <select id="pacienteId" name="pacienteId" defaultValue="" className={`${inputCls} py-1`} style={{ height: "auto" }} size={Math.min(5, Math.max(2, opciones.length + 1))}>
              <option value="" disabled>Seleccione a la persona</option>
              {opciones.map((p) => <option key={p.id} value={String(p.id)}>{p.nombreCompleto}{p.dpi ? ` · ${p.dpi}` : ""}</option>)}
            </select>
          </Field>
          <Field id="campanaId" label="Campaña (opcional)">
            <select id="campanaId" name="campanaId" defaultValue="" className={inputCls}>
              <option value="">Sin campaña</option>
              {(campanas.data ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field id="centroId" label="Centro de diagnóstico" required>
            <select id="centroId" name="centroId" required defaultValue="" className={inputCls}>
              <option value="" disabled>{centros.isLoading ? "Cargando…" : (centros.data ?? []).length ? "Seleccione un centro" : "No hay centros registrados"}</option>
              {(centros.data ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.nombre}{c.departamento ? ` · ${c.departamento}` : ""}</option>)}
            </select>
          </Field>
          <Field id="tipoEstudio" label="Estudio que necesita" required>
            <input id="tipoEstudio" name="tipoEstudio" required maxLength={120} list="estudios-comunes" placeholder="Mamografía" className={inputCls} />
            <datalist id="estudios-comunes">{ESTUDIOS_COMUNES.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field id="motivo" label="Motivo (opcional)"><textarea id="motivo" name="motivo" maxLength={500} rows={3} className={`${inputCls} h-auto py-2`} placeholder="Resultado del tamizaje que lo origina" /></Field>
          <label className="flex items-start gap-2 rounded-xl border bg-accent/50 p-3 text-sm">
            <input type="checkbox" name="consentimiento" className="mt-1" />
            <span>La persona <strong>autorizó</strong> compartir su nombre, DPI, fecha de nacimiento, sexo y teléfono con el centro elegido. El centro no verá el resto de su ficha y usted no verá el resultado clínico.</span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} <Send /> Enviar referido</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
