import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Copy, Eye, EyeOff, KeyRound, Loader2, MoreHorizontal, Pencil, ShieldOff, UserCheck, UserPlus, UserX, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { Avatar, Card, EmptyState, Field, inputCls, ListSkeleton, PageHeader, Tag } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, ApiError, esAdmin, fmtFecha, ROLES, tiempoRelativo, useSession, type Rol, type UsuarioGestion } from "@/lib/api";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios · SISG Grupo 4" },
      { name: "description", content: "Gestione quién puede entrar a su entidad y con qué permisos." },
      { property: "og:title", content: "Usuarios · SISG Grupo 4" },
      { property: "og:description", content: "Gestione quién puede entrar a su entidad y con qué permisos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Usuarios /></AppShell>,
});

const tonoRol: Record<Rol, "teal" | "blue" | "amber"> = { ADMIN: "teal", OPERADOR: "blue", AUDITOR: "amber" };

/** Contraseña aleatoria de 16 caracteres (sin símbolos ambiguos) con el generador criptográfico del navegador. */
function generarPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789#$%&*+-";
  const v = new Uint8Array(16); crypto.getRandomValues(v);
  return Array.from(v, (b) => a[b % a.length]).join("");
}
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");

type Accion = { tipo: "editar" | "activar" | "mfa" | "password"; u: UsuarioGestion } | { tipo: "nuevo" } | null;

function Usuarios() {
  const session = useSession()!;
  const qc = useQueryClient();
  const admin = esAdmin(session);
  const q = useQuery({ queryKey: ["usuarios"], queryFn: api.usuarios, enabled: admin });
  const [accion, setAccion] = useState<Accion>(null);
  const cerrar = () => setAccion(null);
  const refrescar = () => void qc.invalidateQueries({ queryKey: ["usuarios"] });

  const confirmar = useMutation({
    mutationFn: async () => {
      if (accion?.tipo === "activar") await api.editarUsuario(accion.u.id, { activo: !accion.u.activo });
      else if (accion?.tipo === "mfa") await api.restablecerMfa(accion.u.id);
    },
    onSuccess: () => {
      if (accion && accion.tipo !== "nuevo") toast.success(accion.tipo === "mfa" ? "MFA restablecido: deberá configurarlo al entrar" : accion.u.activo ? "Usuario desactivado" : "Usuario activado");
      refrescar(); cerrar();
    },
    onError: (e) => { toast.error(msg(e)); cerrar(); },
  });

  if (!admin) return <Card><EmptyState title="No tiene acceso a esta sección" text="Solo los administradores de la entidad pueden gestionar usuarios." /></Card>;
  const lista = q.data ?? [];

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Quién puede entrar a su entidad y con qué permisos."
        actions={<Button onClick={() => setAccion({ tipo: "nuevo" })}><UserPlus /> Nuevo usuario</Button>} />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {(Object.keys(ROLES) as Rol[]).map((r) => (
          <Card key={r}><Tag tone={tonoRol[r]}>{ROLES[r].label}</Tag><p className="mt-2 text-sm text-muted-foreground">{ROLES[r].desc}</p></Card>
        ))}
      </div>

      <Card>
        {q.isLoading && <ListSkeleton />}
        {q.isError && <EmptyState error title="No pudimos cargar los usuarios" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && (
          <ul className="divide-y">
            {lista.map((u) => {
              const yo = u.id === session.usuario.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <Avatar name={u.nombre} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{u.nombre} {yo && <span className="text-xs font-medium text-muted-foreground">(usted)</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.correo}</p>
                  </div>
                  <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
                    <Tag tone={tonoRol[u.rol]}>{ROLES[u.rol].label}</Tag>
                    <Tag tone={u.activo ? "teal" : "coral"}>{u.activo ? "Activo" : "Desactivado"}</Tag>
                    <Tag tone={u.mfaActivo ? "teal" : "amber"}>{u.mfaActivo ? "MFA activo" : "MFA pendiente"}</Tag>
                  </div>
                  <p className="order-4 w-full text-xs text-muted-foreground sm:order-none sm:w-32" title={u.ultimoAcceso ? fmtFecha(u.ultimoAcceso) : undefined}>{u.ultimoAcceso ? `Entró ${tiempoRelativo(u.ultimoAcceso)}` : "Nunca ha entrado"}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones para ${u.nombre}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setAccion({ tipo: "editar", u })}><Pencil /> Editar</DropdownMenuItem>
                      {!yo && <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setAccion({ tipo: "password", u })}><KeyRound /> Restablecer contraseña</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAccion({ tipo: "mfa", u })}><ShieldOff /> Restablecer MFA</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAccion({ tipo: "activar", u })}>{u.activo ? <><UserX /> Desactivar</> : <><UserCheck /> Activar</>}</DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <UsuarioDialog accion={accion} onClose={cerrar} onDone={refrescar} />
      <PasswordDialog accion={accion} onClose={cerrar} />

      <AlertDialog open={accion?.tipo === "activar" || accion?.tipo === "mfa"} onOpenChange={(o) => { if (!o) cerrar(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accion?.tipo === "mfa" ? "¿Restablecer la verificación en dos pasos?" : accion?.tipo === "activar" && accion.u.activo ? "¿Desactivar este usuario?" : "¿Activar este usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accion && accion.tipo !== "nuevo" && accion.tipo !== "editar" && accion.tipo !== "password" && (accion.tipo === "mfa"
                ? `${accion.u.nombre} perderá su teléfono vinculado y sus códigos de recuperación, y se cerrará su sesión. Deberá configurar el MFA de nuevo la próxima vez que entre.`
                : accion.u.activo
                  ? `${accion.u.nombre} no podrá iniciar sesión y se cerrará su sesión actual. No se borra nada: su historial queda en la auditoría.`
                  : `${accion.u.nombre} podrá volver a iniciar sesión con su contraseña y su MFA.`)}
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

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="space-y-2">
      <div className="relative">
        <input id={id} type={ver ? "text" : "password"} required minLength={10} maxLength={72} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-11`} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
          {ver ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { onChange(generarPassword()); setVer(true); }}><Wand2 /> Generar</Button>
        <Button type="button" variant="outline" size="sm" disabled={!value} onClick={() => { void navigator.clipboard?.writeText(value); toast.success("Contraseña copiada"); }}><Copy /> Copiar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Mínimo 10 caracteres. Compártala por un canal seguro: la persona puede cambiarla en «Mi cuenta».</p>
    </div>
  );
}

/** Crear usuario o editar nombre y rol. */
function UsuarioDialog({ accion, onClose, onDone }: { accion: Accion; onClose: () => void; onDone: () => void }) {
  const open = accion?.tipo === "nuevo" || accion?.tipo === "editar";
  const u = accion?.tipo === "editar" ? accion.u : null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        {open && <UsuarioForm key={u?.id ?? "nuevo"} u={u} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function UsuarioForm({ u, onClose, onDone }: { u: UsuarioGestion | null; onClose: () => void; onDone: () => void }) {
  const session = useSession()!;
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>(u?.rol ?? "OPERADOR");
  const yo = u?.id === session.usuario.id;
  const m = useMutation({
    mutationFn: (b: { nombre: string; correo: string }) => u
      ? api.editarUsuario(u.id, { nombre: b.nombre, ...(rol !== u.rol && { rol }) })
      : api.crearUsuario({ ...b, rol, password }),
    onSuccess: () => { toast.success(u ? "Usuario actualizado" : "Usuario creado: ya puede iniciar sesión"); onDone(); onClose(); },
    onError: (e) => setError(msg(e)),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    const nombre = String(fd.get("nombre") ?? "").trim(), correo = String(fd.get("correo") ?? "").trim();
    if (!nombre) { setError("Escriba el nombre."); return; }
    if (!u && password.length < 10) { setError("La contraseña debe tener al menos 10 caracteres."); return; }
    m.mutate({ nombre, correo });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{u ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        <DialogDescription>{u ? u.correo : "Entrará con este correo y la contraseña que defina; configurará su MFA en el primer acceso."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <Field id="nombre" label="Nombre completo" required><input id="nombre" name="nombre" required maxLength={120} defaultValue={u?.nombre} className={inputCls} /></Field>
        {!u && <Field id="correo" label="Correo electrónico" required><input id="correo" name="correo" type="email" required maxLength={120} autoComplete="off" className={inputCls} /></Field>}
        <Field id="rol" label="Rol" required>
          <select id="rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={yo} className={inputCls}>
            {(Object.keys(ROLES) as Rol[]).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </select>
        </Field>
        <p className="-mt-1 text-xs text-muted-foreground">{yo ? "No puede cambiar su propio rol." : ROLES[rol].desc}{u && rol !== u.rol && " Se cerrará su sesión para aplicar el cambio."}</p>
        {!u && <Field id="password" label="Contraseña inicial" required><PasswordInput id="password" value={password} onChange={setPassword} /></Field>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span></div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} {u ? "Guardar" : "Crear usuario"}</Button>
        </div>
      </form>
    </>
  );
}

function PasswordDialog({ accion, onClose }: { accion: Accion; onClose: () => void }) {
  const u = accion?.tipo === "password" ? accion.u : null;
  return (
    <Dialog open={!!u} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">{u && <PasswordForm key={u.id} u={u} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function PasswordForm({ u, onClose }: { u: UsuarioGestion; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.restablecerPassword(u.id, password),
    onSuccess: () => { toast.success("Contraseña restablecida y sesión cerrada"); onClose(); },
    onError: (e) => setError(msg(e)),
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Restablecer contraseña</DialogTitle>
        <DialogDescription>{u.nombre} · {u.correo}. Se cerrará su sesión actual.</DialogDescription>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (password.length < 10) { setError("La contraseña debe tener al menos 10 caracteres."); return; } m.mutate(); }} className="space-y-3">
        <Field id="nueva" label="Contraseña nueva" required><PasswordInput id="nueva" value={password} onChange={setPassword} /></Field>
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span></div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Restablecer</Button>
        </div>
      </form>
    </>
  );
}
