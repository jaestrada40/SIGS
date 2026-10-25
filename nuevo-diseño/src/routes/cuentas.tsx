import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, KeyRound, Loader2, MoreHorizontal, Search, UserCheck, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { EnlaceInvitacion, type Entregado } from "@/components/sisg/EnlaceInvitacion";
import { Avatar, Card, EmptyState, Field, inputCls, ListSkeleton, PageHeader, Tag, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, ApiError, esSuperadmin, fmtFecha, ROLES, tiempoRelativo, useSession, type Rol, type UsuarioPlataforma } from "@/lib/api";

export const Route = createFileRoute("/cuentas")({
  head: () => ({
    meta: [
      { title: "Usuarios · SISG Grupo 4" },
      { name: "description", content: "Todas las cuentas de la plataforma." },
    ],
  }),
  component: () => <AppShell><Cuentas /></AppShell>,
});

const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");
const tonoRol: Record<Rol, Tono> = { SUPERADMIN: "coral", ADMIN: "teal", OPERADOR: "blue", AUDITOR: "amber" };
type Accion = { tipo: "activo" | "acceso"; u: UsuarioPlataforma } | null;

function Cuentas() {
  const session = useSession()!;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cuentas"], queryFn: api.usuariosPlataforma, enabled: esSuperadmin(session) });
  const [texto, setTexto] = useState("");
  const [entidad, setEntidad] = useState("");
  const [accion, setAccion] = useState<Accion>(null);
  const [nuevo, setNuevo] = useState(false);
  const [entregado, setEntregado] = useState<Entregado | null>(null);
  const refrescar = () => { void qc.invalidateQueries({ queryKey: ["cuentas"] }); void qc.invalidateQueries({ queryKey: ["resumen-plataforma"] }); void qc.invalidateQueries({ queryKey: ["entidades"] }); };

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!accion) return null;
      if (accion.tipo === "activo") { await api.activoUsuario(accion.u.id, !accion.u.activo); return null; }
      const r = await api.restablecerAcceso(accion.u.id);
      return { titulo: "Acceso restablecido", para: accion.u.nombre, token: r.invitacion, vence: r.vence } satisfies Entregado;
    },
    onSuccess: (r) => {
      if (r) setEntregado(r); else toast.success(accion?.u.activo ? "Usuario desactivado: se cerró su sesión" : "Usuario activado");
      refrescar(); setAccion(null);
    },
    onError: (e) => { toast.error(msg(e)); setAccion(null); },
  });

  if (!esSuperadmin(session)) return <Card><EmptyState title="No tiene acceso a esta sección" text="Solo el superadministrador ve las cuentas de la plataforma." /></Card>;

  const todos = q.data ?? [];
  const entidades = [...new Set(todos.map((u) => u.entidad).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es"));
  const t = texto.trim().toLowerCase();
  const lista = todos.filter((u) => (!entidad || u.entidad === entidad) && (!t || u.nombre.toLowerCase().includes(t) || u.correo.toLowerCase().includes(t)));

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Todas las cuentas de todas las entidades. Los roles y permisos los define el administrador de cada entidad."
        actions={<Button onClick={() => setNuevo(true)}><UserPlus /> Nuevo superadmin</Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" aria-label="Buscar usuario" placeholder="Buscar por nombre o correo" value={texto} onChange={(e) => setTexto(e.target.value)} className={`${inputCls} pl-9`} />
        </div>
        <select aria-label="Filtrar por entidad" value={entidad} onChange={(e) => setEntidad(e.target.value)} className={`${inputCls} sm:w-64`}>
          <option value="">Todas las entidades</option>
          {entidades.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <Card>
        {q.isLoading && <ListSkeleton />}
        {q.isError && <EmptyState error title="No pudimos cargar los usuarios" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && lista.length === 0 && <EmptyState title="Sin resultados" text="Ningún usuario coincide con la búsqueda." />}
        {q.data && lista.length > 0 && (
          <ul className="divide-y">
            {lista.map((u) => {
              const yo = u.id === session.usuario.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <Avatar name={u.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{u.nombre} {yo && <span className="text-xs font-medium text-muted-foreground">(usted)</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.correo} · {u.entidad ?? "Sin entidad"}</p>
                  </div>
                  <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
                    <Tag tone={tonoRol[u.rol]}>{ROLES[u.rol].label}</Tag>
                    <Tag tone={u.activo ? "teal" : "coral"}>{u.activo ? "Activo" : "Desactivado"}</Tag>
                    {u.invitacion
                      ? <Tag tone="amber">{u.invitacion === "vencida" ? "Invitación vencida" : "Invitación pendiente"}</Tag>
                      : <Tag tone={u.mfaActivo ? "teal" : "amber"}>{u.mfaActivo ? "MFA activo" : "MFA pendiente"}</Tag>}
                    {!u.entidadActiva && <Tag tone="coral">Entidad suspendida</Tag>}
                  </div>
                  <p className="order-4 w-full text-xs text-muted-foreground sm:order-none sm:w-32" title={u.ultimoAcceso ? fmtFecha(u.ultimoAcceso) : undefined}>{u.ultimoAcceso ? `Entró ${tiempoRelativo(u.ultimoAcceso)}` : "Nunca ha entrado"}</p>
                  {!yo ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones para ${u.nombre}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.activo && <DropdownMenuItem onSelect={() => setAccion({ tipo: "acceso", u })}><KeyRound /> Restablecer acceso</DropdownMenuItem>}
                        {u.activo && <DropdownMenuSeparator />}
                        <DropdownMenuItem onSelect={() => setAccion({ tipo: "activo", u })}>{u.activo ? <><UserX /> Desactivar</> : <><UserCheck /> Activar</>}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : <span className="h-10 w-10" aria-hidden />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={nuevo} onOpenChange={setNuevo}>
        <DialogContent className="max-w-md">{nuevo && <SuperadminForm onClose={() => setNuevo(false)} onCreado={(r) => { setNuevo(false); setEntregado(r); refrescar(); }} />}</DialogContent>
      </Dialog>
      <EnlaceInvitacion entregado={entregado} onClose={() => setEntregado(null)} />

      <AlertDialog open={!!accion} onOpenChange={(o) => { if (!o) setAccion(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{accion?.tipo === "acceso" ? "¿Restablecer el acceso?" : accion?.u.activo ? "¿Desactivar este usuario?" : "¿Activar este usuario?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {accion?.tipo === "acceso"
                ? `${accion.u.nombre} perderá su contraseña y su verificación en dos pasos, y se cerrará su sesión. Recibirá un enlace nuevo, de un solo uso, para crearlos otra vez. Úselo cuando no pueda entrar y no haya otro administrador en su entidad.`
                : accion?.u.activo
                  ? `${accion.u.nombre} no podrá iniciar sesión y se cerrará su sesión actual. No se borra nada: su historial queda en la auditoría.`
                  : `${accion?.u.nombre} podrá volver a iniciar sesión con su contraseña y su MFA.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmar.mutate(); }} disabled={confirmar.isPending}>
              {confirmar.isPending && <Loader2 className="animate-spin" />} Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SuperadminForm({ onClose, onCreado }: { onClose: () => void; onCreado: (r: Entregado) => void }) {
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: api.crearSuperadmin,
    onSuccess: (r, b) => onCreado({ titulo: "Enlace de invitación", para: b.nombre, token: r.invitacion, vence: r.vence }),
    onError: (e) => setError(msg(e)),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    m.mutate({ nombre: String(fd.get("nombre") ?? "").trim(), correo: String(fd.get("correo") ?? "").trim() });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Nuevo superadmin</DialogTitle>
        <DialogDescription>Tener más de uno evita que perder una cuenta deje la plataforma sin quien la gestione. Recibirá un enlace para crear su contraseña y su MFA.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field id="nombre" label="Nombre" required><input id="nombre" name="nombre" required maxLength={120} autoComplete="off" className={inputCls} /></Field>
        <Field id="correo" label="Correo" required><input id="correo" name="correo" type="email" required maxLength={120} autoComplete="off" className={inputCls} /></Field>
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span></div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Crear y generar enlace</Button>
        </div>
      </form>
    </>
  );
}
