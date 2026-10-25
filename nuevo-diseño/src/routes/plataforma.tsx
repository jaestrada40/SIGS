import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Copy, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { Avatar, Card, EmptyState, Field, inputCls, ListSkeleton, PageHeader, Tag, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, esSuperadmin, fmtFecha, tiempoRelativo, useSession, type EntidadAlta } from "@/lib/api";

export const Route = createFileRoute("/plataforma")({
  head: () => ({
    meta: [
      { title: "Entidades · SISG Grupo 4" },
      { name: "description", content: "Alta de centros de diagnóstico y organismos no lucrativos." },
    ],
  }),
  component: () => <AppShell><Plataforma /></AppShell>,
});

const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");
const estados: Record<EntidadAlta["estado"], { label: string; tone: Tono }> = {
  activa: { label: "Activa", tone: "teal" },
  invitada: { label: "Invitación pendiente", tone: "amber" },
  invitacion_vencida: { label: "Invitación vencida", tone: "coral" },
  sin_administrador: { label: "Sin administrador", tone: "coral" },
};
const tipos = { CENTRO_DIAGNOSTICO: "Centro de diagnóstico", ORG_NO_LUCRATIVA: "Organismo no lucrativo", PLATAFORMA: "Plataforma" } as const;
const enlace = (token: string) => `${window.location.origin}/?invitacion=${encodeURIComponent(token)}`;

function Plataforma() {
  const session = useSession()!;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["entidades"], queryFn: api.entidades, enabled: esSuperadmin(session) });
  const [nueva, setNueva] = useState(false);
  const [entregada, setEntregada] = useState<{ nombre: string; token: string; vence: string } | null>(null);
  const refrescar = () => void qc.invalidateQueries({ queryKey: ["entidades"] });

  const reinvitar = useMutation({
    mutationFn: (e: EntidadAlta) => api.reinvitar(e.id).then((r) => ({ nombre: e.nombre, token: r.invitacion, vence: r.vence })),
    onSuccess: (r) => { setEntregada(r); refrescar(); },
    onError: (e) => toast.error(msg(e)),
  });

  if (!esSuperadmin(session)) return <Card><EmptyState title="No tiene acceso a esta sección" text="Solo el superadministrador da de alta entidades." /></Card>;

  return (
    <>
      <PageHeader title="Entidades" subtitle="Centros de diagnóstico y organismos no lucrativos con acceso a la plataforma."
        actions={<Button onClick={() => setNueva(true)}><Plus /> Nueva entidad</Button>} />
      <Card>
        {q.isLoading && <ListSkeleton />}
        {q.isError && <EmptyState error title="No pudimos cargar las entidades" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data?.length === 0 && <EmptyState title="Aún no hay entidades" text="Cree la primera y envíele su enlace de invitación." />}
        {!!q.data?.length && (
          <ul className="divide-y">
            {q.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                <Avatar name={e.nombre} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.correo}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={e.tipo === "CENTRO_DIAGNOSTICO" ? "blue" : "coral"}>{tipos[e.tipo]}</Tag>
                  <Tag tone={estados[e.estado].tone}>{estados[e.estado].label}</Tag>
                </div>
                <p className="w-full text-xs text-muted-foreground sm:w-32" title={e.ultimoAcceso ? fmtFecha(e.ultimoAcceso) : undefined}>{e.ultimoAcceso ? `Entró ${tiempoRelativo(e.ultimoAcceso)}` : "Nunca ha entrado"}</p>
                {(e.estado === "invitada" || e.estado === "invitacion_vencida") && (
                  <Button variant="outline" size="sm" disabled={reinvitar.isPending} onClick={() => reinvitar.mutate(e)}><Link2 /> Nuevo enlace</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={nueva} onOpenChange={setNueva}>
        <DialogContent className="max-w-md">
          {nueva && <EntidadForm onClose={() => setNueva(false)} onCreada={(r) => { setNueva(false); setEntregada(r); refrescar(); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!entregada} onOpenChange={(o) => { if (!o) setEntregada(null); }}>
        <DialogContent className="max-w-md">
          {entregada && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Enlace de invitación</DialogTitle>
                <DialogDescription>Envíe este enlace a {entregada.nombre}. Sirve una sola vez y vence el {fmtFecha(entregada.vence)}. No se vuelve a mostrar.</DialogDescription>
              </DialogHeader>
              <p className="break-all rounded-xl bg-secondary p-3 font-mono text-xs">{enlace(entregada.token)}</p>
              <Button onClick={() => { void navigator.clipboard?.writeText(enlace(entregada.token)); toast.success("Enlace copiado"); }}><Copy /> Copiar enlace</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EntidadForm({ onClose, onCreada }: { onClose: () => void; onCreada: (r: { nombre: string; token: string; vence: string }) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"CENTRO_DIAGNOSTICO" | "ORG_NO_LUCRATIVA">("CENTRO_DIAGNOSTICO");
  const m = useMutation({
    mutationFn: api.crearEntidad,
    onSuccess: (r) => onCreada({ nombre: r.entidad.nombre, token: r.invitacion, vence: r.vence }),
    onError: (e) => setError(msg(e)),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    const txt = (k: string) => String(fd.get(k) ?? "").trim();
    m.mutate({ nombre: txt("nombre"), tipo, correo: txt("correo"), departamento: txt("departamento") || undefined, telefono: txt("telefono") || undefined });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Nueva entidad</DialogTitle>
        <DialogDescription>Verifique que la entidad existe antes de darla de alta. Recibirá un enlace para crear su contraseña y su MFA.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field id="tipo" label="Tipo de entidad" required>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputCls}>
            <option value="CENTRO_DIAGNOSTICO">Centro de diagnóstico</option>
            <option value="ORG_NO_LUCRATIVA">Organismo no lucrativo</option>
          </select>
        </Field>
        <Field id="nombre" label="Nombre" required><input id="nombre" name="nombre" required maxLength={120} autoComplete="off" className={inputCls} placeholder="Centro El Roble" /></Field>
        <Field id="correo" label="Correo del administrador" required><input id="correo" name="correo" type="email" required maxLength={120} autoComplete="off" className={inputCls} placeholder="contacto@entidad.gt" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="departamento" label="Departamento"><input id="departamento" name="departamento" maxLength={60} autoComplete="off" className={inputCls} placeholder="Opcional" /></Field>
          <Field id="telefono" label="Teléfono"><input id="telefono" name="telefono" type="tel" maxLength={30} autoComplete="off" className={inputCls} placeholder="Opcional" /></Field>
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? <Loader2 className="animate-spin" /> : <Building2 />} Crear y generar enlace</Button>
        </div>
      </form>
    </>
  );
}
