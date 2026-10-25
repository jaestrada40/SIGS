import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError, fmtFecha, useSession, type Estudio, type Paciente } from "@/lib/api";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { inputCls } from "@/components/sisg/ui";

/** Avisos a la persona desde un estudio: recordatorio de cita (sin decir qué estudio es) y enlace seguro para ver el resultado. */
export function AvisosEstudio({ e, paciente }: { e: Estudio; paciente: Paciente | undefined }) {
  const centro = useSession()!.entidad.nombre;
  const nombre = paciente?.nombreCompleto.split(" ")[0] ?? "";
  const recordatorio = e.estado === "PROGRAMADO"
    ? enlaceWhatsApp(paciente?.telefono, `Hola ${nombre}, le recordamos su cita en ${centro} el ${fmtFecha(e.fecha)}${e.hora ? ` a las ${e.hora.slice(0, 5)}` : ""}. Si no puede asistir, avísenos por favor.`)
    : null;
  const conResultado = e.estado === "REALIZADO" && !!e.resultado?.trim();
  if (!recordatorio && !conResultado) return null;
  return (
    <section aria-label="Avisar a la persona" className="mt-6 space-y-3 rounded-2xl border bg-accent/40 p-4">
      <h3 className="font-semibold">Avisar a la persona</h3>
      {e.estado === "PROGRAMADO" && !recordatorio && <p className="text-sm text-muted-foreground">Para enviar un recordatorio por WhatsApp, registre un teléfono de 8 dígitos en la ficha del paciente.</p>}
      {recordatorio && (
        <>
          <Button asChild variant="outline" size="sm"><a href={recordatorio} target="_blank" rel="noopener noreferrer"><MessageCircle /> Recordar por WhatsApp</a></Button>
          <p className="text-xs text-muted-foreground">Abre WhatsApp con el mensaje listo; usted decide si lo envía. El mensaje no menciona el tipo de estudio.</p>
        </>
      )}
      {conResultado && <EnlaceResultadoPanel e={e} paciente={paciente} />}
    </section>
  );
}

function EnlaceResultadoPanel({ e, paciente }: { e: Estudio; paciente: Paciente | undefined }) {
  const qc = useQueryClient();
  const [dias, setDias] = useState("7");
  const [nuevo, setNuevo] = useState<{ url: string; expiraEn: string } | null>(null);
  const lista = useQuery({ queryKey: ["enlaces", e.id], queryFn: () => api.enlaces(e.id) });
  const crear = useMutation({
    mutationFn: () => api.crearEnlace(e.id, Number(dias)),
    onSuccess: (r) => { setNuevo({ url: `${window.location.origin}/resultado/${r.token}`, expiraEn: r.expiraEn }); void qc.invalidateQueries({ queryKey: ["enlaces", e.id] }); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "No se pudo crear el enlace."),
  });
  const revocar = useMutation({
    mutationFn: (id: number) => api.revocarEnlace(id),
    onSuccess: () => { toast.success("Enlace revocado"); setNuevo(null); void qc.invalidateQueries({ queryKey: ["enlaces", e.id] }); },
  });
  const activos = (lista.data ?? []).filter((l) => !l.revocadoEn && new Date(l.expiraEn) > new Date());
  const whatsapp = nuevo ? enlaceWhatsApp(paciente?.telefono, `Hola ${paciente?.nombreCompleto.split(" ")[0] ?? ""}, su resultado está disponible: ${nuevo.url}\nPara abrirlo necesitará su fecha de nacimiento. El enlace vence el ${fmtFecha(nuevo.expiraEn.slice(0, 10))}.`) : null;

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium">Resultado para la persona</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Vigencia del enlace" value={dias} onChange={(x) => setDias(x.target.value)} className={`${inputCls} w-auto`}>
          {[["3", "3 días"], ["7", "7 días"], ["14", "14 días"], ["30", "30 días"]].map(([v, l]) => <option key={v} value={v}>Vence en {l}</option>)}
        </select>
        <Button type="button" size="sm" onClick={() => crear.mutate()} disabled={crear.isPending}>{crear.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Crear enlace</Button>
      </div>
      {nuevo && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <p className="break-all font-mono text-xs">{nuevo.url}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(nuevo.url).then(() => toast.success("Enlace copiado")); }}><Copy /> Copiar</Button>
            {whatsapp && <Button asChild size="sm" variant="outline"><a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle /> Enviar por WhatsApp</a></Button>}
          </div>
          <p className="text-xs text-muted-foreground">Cópielo ahora: no se vuelve a mostrar. La persona deberá escribir su fecha de nacimiento (o los últimos 4 dígitos de su DPI) para verlo.</p>
        </div>
      )}
      {activos.length > 0 && (
        <ul className="space-y-1 text-sm">
          {activos.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Vence {fmtFecha(l.expiraEn.slice(0, 10))} · {l.accesos} {l.accesos === 1 ? "vez abierto" : "veces abierto"}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => revocar.mutate(l.id)} disabled={revocar.isPending}>Revocar</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
