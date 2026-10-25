import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, ApiError, ROLES, setSession, type Session } from "@/lib/api";
import { Field, inputCls, Tag } from "./ui";

/** Datos de la persona que inició sesión y cambio de su propia contraseña. */
export function CuentaDialog({ open, onOpenChange, session }: { open: boolean; onOpenChange: (o: boolean) => void; session: Session }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ver, setVer] = useState(false);
  const u = session.usuario;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const actual = String(fd.get("actual") ?? ""), nueva = String(fd.get("nueva") ?? ""), repite = String(fd.get("repite") ?? "");
    if (nueva.length < 10) { setError("La contraseña nueva debe tener al menos 10 caracteres."); return; }
    if (nueva !== repite) { setError("Las contraseñas nuevas no coinciden."); return; }
    setLoading(true);
    try {
      const r = await api.cambiarPassword({ actual, nueva });
      setSession({ token: r.access_token, entidad: r.entidad, usuario: r.usuario });   // las demás sesiones se cierran en el servidor
      toast.success("Contraseña actualizada");
      form.reset(); onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña.");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setError(null); setVer(false); } onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Mi cuenta</DialogTitle>
          <DialogDescription>{u.nombre} · {u.correo}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Tag tone="teal">{ROLES[u.rol].label}</Tag>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Verificación en dos pasos activa</span>
        </div>
        <p className="text-xs text-muted-foreground">{ROLES[u.rol].desc}</p>
        <form onSubmit={submit} className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-bold">Cambiar contraseña</h3>
          <Field id="actual" label="Contraseña actual"><input id="actual" name="actual" type={ver ? "text" : "password"} required autoComplete="current-password" className={inputCls} /></Field>
          <Field id="nueva" label="Contraseña nueva"><input id="nueva" name="nueva" type={ver ? "text" : "password"} required minLength={10} autoComplete="new-password" className={inputCls} /></Field>
          <Field id="repite" label="Repita la contraseña nueva"><input id="repite" name="repite" type={ver ? "text" : "password"} required minLength={10} autoComplete="new-password" className={inputCls} /></Field>
          <button type="button" onClick={() => setVer((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            {ver ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />} {ver ? "Ocultar contraseñas" : "Mostrar contraseñas"}
          </button>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span></div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Cambiar contraseña</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
