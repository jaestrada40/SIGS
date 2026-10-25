import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtFecha } from "@/lib/api";

export type Entregado = { titulo?: string; para: string; token: string; vence: string };
const enlace = (token: string) => `${window.location.origin}/?invitacion=${encodeURIComponent(token)}`;

/** El enlace de invitación solo se muestra aquí, una vez: el servidor guarda únicamente su huella. */
export function EnlaceInvitacion({ entregado, onClose }: { entregado: Entregado | null; onClose: () => void }) {
  return (
    <Dialog open={!!entregado} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        {entregado && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{entregado.titulo ?? "Enlace de invitación"}</DialogTitle>
              <DialogDescription>Envíe este enlace a {entregado.para}. Sirve una sola vez y vence el {fmtFecha(entregado.vence)}. No se vuelve a mostrar.</DialogDescription>
            </DialogHeader>
            <p className="break-all rounded-xl bg-secondary p-3 font-mono text-xs">{enlace(entregado.token)}</p>
            <Button onClick={() => { void navigator.clipboard?.writeText(enlace(entregado.token)); toast.success("Enlace copiado"); }}><Copy /> Copiar enlace</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
