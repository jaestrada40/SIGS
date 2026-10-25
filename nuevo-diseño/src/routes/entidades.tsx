import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Ban, Building2, Link2, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { Avatar, Card, EmptyState, Field, inputCls, ListSkeleton, PageHeader, Tag, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EnlaceInvitacion, type Entregado } from "@/components/sisg/EnlaceInvitacion";
import { api, ApiError, esSuperadmin, fmtFecha, tiempoRelativo, useSession, type EntidadAlta } from "@/lib/api";

export const Route = createFileRoute("/entidades")({
  head: () => ({
    meta: [
      { title: "Entidades · SISG Grupo 4" },
      { name: "description", content: "Alta de centros de diagnóstico y organismos no lucrativos." },
    ],
  }),
  component: () => <AppShell><Entidades /></AppShell>,
});

const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");
const estados: Record<EntidadAlta["estado"], { label: string; tone: Tono }> = {
  activa: { label: "Activa", tone: "teal" },
  invitada: { label: "Invitación pendiente", tone: "amber" },
  invitacion_vencida: { label: "Invitación vencida", tone: "coral" },
  suspendida: { label: "Suspendida", tone: "coral" },
  sin_administrador: { label: "Sin administrador", tone: "coral" },
};
const tipos = { CENTRO_DIAGNOSTICO: "Centro de diagnóstico", ORG_NO_LUCRATIVA: "Organismo no lucrativo", PLATAFORMA: "Plataforma" } as const;

function Entidades() {
  const session = useSession()!;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["entidades"], queryFn: api.entidades, enabled: esSuperadmin(session) });
  const [nueva, setNueva] = useState(false);
  const [editar, setEditar] = useState<EntidadAlta | null>(null);
  const [suspender, setSuspender] = useState<EntidadAlta | null>(null);
  const [entregado, setEntregado] = useState<Entregado | null>(null);
  const refrescar = () => { void qc.invalidateQueries({ queryKey: ["entidades"] }); void qc.invalidateQueries({ queryKey: ["resumen-plataforma"] }); };

  const reinvitar = useMutation({
    mutationFn: (e: EntidadAlta) => api.reinvitar(e.id).then((r) => ({ para: e.nombre, token: r.invitacion, vence: r.vence })),
    onSuccess: (r) => { setEntregado(r); refrescar(); },
    onError: (e) => toast.error(msg(e)),
  });
  const estado = useMutation({
    mutationFn: (e: EntidadAlta) => api.estadoEntidad(e.id, !e.activa),
    onSuccess: (_, e) => { toast.success(e.activa ? "Entidad suspendida: nadie de ella puede entrar" : "Entidad reactivada"); refrescar(); setSuspender(null); },
    onError: (e) => { toast.error(msg(e)); setSuspender(null); },
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
                  <p className="truncate text-xs text-muted-foreground">{e.correo}{e.departamento ? ` · ${e.departamento}` : ""} · {e.usuariosActivos} {e.usuariosActivos === 1 ? "usuario activo" : "usuarios activos"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={e.tipo === "CENTRO_DIAGNOSTICO" ? "blue" : "coral"}>{tipos[e.tipo]}</Tag>
                  <Tag tone={estados[e.estado].tone}>{estados[e.estado].label}</Tag>
                </div>
                <p className="w-full text-xs text-muted-foreground sm:w-32" title={e.ultimoAcceso ? fmtFecha(e.ultimoAcceso) : undefined}>{e.ultimoAcceso ? `Entró ${tiempoRelativo(e.ultimoAcceso)}` : "Nunca ha entrado"}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones para ${e.nombre}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditar(e)}><Pencil /> Editar datos</DropdownMenuItem>
                    {(e.estado === "invitada" || e.estado === "invitacion_vencida") && <DropdownMenuItem onSelect={() => reinvitar.mutate(e)}><Link2 /> Nuevo enlace de invitación</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => (e.activa ? setSuspender(e) : estado.mutate(e))}>{e.activa ? <><Ban /> Suspender</> : <><RotateCcw /> Reactivar</>}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={nueva} onOpenChange={setNueva}>
        <DialogContent className="max-w-md">
          {nueva && <EntidadForm onClose={() => setNueva(false)} onCreada={(r) => { setNueva(false); setEntregado(r); refrescar(); }} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editar} onOpenChange={(o) => { if (!o) setEditar(null); }}>
        <DialogContent className="max-w-md">{editar && <EditarForm e={editar} onClose={() => setEditar(null)} onDone={refrescar} />}</DialogContent>
      </Dialog>
      <EnlaceInvitacion entregado={entregado} onClose={() => setEntregado(null)} />

      <AlertDialog open={!!suspender} onOpenChange={(o) => { if (!o) setSuspender(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Suspender {suspender?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>Nadie de la entidad podrá entrar y se cerrarán sus sesiones abiertas ahora mismo. No se borra nada: al reactivarla todo sigue como estaba.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(ev) => { ev.preventDefault(); if (suspender) estado.mutate(suspender); }} disabled={estado.isPending}>
              {estado.isPending && <Loader2 className="animate-spin" />} Suspender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditarForm({ e, onClose, onDone }: { e: EntidadAlta; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (b: { nombre: string; departamento: string; telefono: string }) => api.editarEntidad(e.id, b),
    onSuccess: () => { toast.success("Entidad actualizada"); onDone(); onClose(); },
    onError: (x) => setError(msg(x)),
  });
  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault(); setError(null);
    const fd = new FormData(ev.currentTarget);
    const txt = (k: string) => String(fd.get(k) ?? "").trim();
    if (!txt("nombre")) { setError("Escriba el nombre."); return; }
    m.mutate({ nombre: txt("nombre"), departamento: txt("departamento"), telefono: txt("telefono") });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Editar entidad</DialogTitle>
        <DialogDescription>{tipos[e.tipo]} · {e.correo}. El tipo y el correo del administrador no se cambian aquí.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field id="nombre" label="Nombre" required><input id="nombre" name="nombre" required maxLength={120} defaultValue={e.nombre} autoComplete="off" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="departamento" label="Departamento"><input id="departamento" name="departamento" maxLength={60} defaultValue={e.departamento ?? ""} autoComplete="off" className={inputCls} /></Field>
          <Field id="telefono" label="Teléfono"><input id="telefono" name="telefono" type="tel" maxLength={30} defaultValue={e.telefono ?? ""} autoComplete="off" className={inputCls} /></Field>
        </div>
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span></div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Guardar</Button>
        </div>
      </form>
    </>
  );
}

function EntidadForm({ onClose, onCreada }: { onClose: () => void; onCreada: (r: Entregado) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"CENTRO_DIAGNOSTICO" | "ORG_NO_LUCRATIVA">("CENTRO_DIAGNOSTICO");
  const m = useMutation({
    mutationFn: api.crearEntidad,
    onSuccess: (r) => onCreada({ para: r.entidad.nombre, token: r.invitacion, vence: r.vence }),
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
