import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FilterChip, inputCls } from "./ui";
import { redactarDifusion, type EntradaDifusion } from "@/lib/difusion.functions";
import { fmtFecha, type Campana } from "@/lib/api";

const CANALES: EntradaDifusion["canales"] = ["WhatsApp", "Radio comunitaria", "Facebook", "Afiche"];
const TONOS: EntradaDifusion["tono"][] = ["Cálido y cercano", "Formal e informativo", "Urgente y motivador"];
const AREA_LABEL: Record<string, string> = { CARDIOVASCULAR: "Cardiovascular", RESPIRATORIA: "Respiratoria", PLANIFICACION: "Planificación familiar", ONCOLOGICO_OTRO: "Oncológico u otro" };

export function DifusionDialog({ open, onOpenChange, campanas, inicial }: { open: boolean; onOpenChange: (o: boolean) => void; campanas: Campana[]; inicial?: Campana | null | undefined }) {
  const redactar = useServerFn(redactarDifusion);
  const [campanaId, setCampanaId] = useState<string>("");
  const [canales, setCanales] = useState<EntradaDifusion["canales"]>(["WhatsApp", "Radio comunitaria"]);
  const [tono, setTono] = useState<EntradaDifusion["tono"]>("Cálido y cercano");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<{ canal: string; texto: string }[]>([]);
  const [copiado, setCopiado] = useState<number | null>(null);

  const idSel = campanaId || (inicial ? String(inicial.id) : String(campanas[0]?.id ?? ""));
  const c = campanas.find((x) => String(x.id) === idSel);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!c) return;
    const fd = new FormData(e.currentTarget);
    const objetivos = String(fd.get("objetivos") ?? "").trim();
    const publico = String(fd.get("publico") ?? "").trim();
    if (objetivos.length < 5 || publico.length < 3) { setError("Escriba los objetivos y el público de la campaña."); return; }
    if (!canales.length) { setError("Elija al menos un canal."); return; }
    setError(null); setCargando(true); setMensajes([]);
    try {
      const lugar = [c.ubicacion, c.departamento].filter(Boolean).join(", ");
      const fechas = c.fechaFin ? `${fmtFecha(c.fechaInicio)} al ${fmtFecha(c.fechaFin)}` : fmtFecha(c.fechaInicio);
      const r = await redactar({ data: { campana: c.nombre, area: AREA_LABEL[c.area] ?? c.area, objetivos, publico, canales, tono, fechas, ...(lugar ? { lugar } : {}) } });
      if ("error" in r) setError(r.error); else setMensajes(r.mensajes);
    } catch {
      setError("No pudimos redactar los mensajes. Revise su conexión e intente de nuevo.");
    } finally { setCargando(false); }
  }

  async function copiar(i: number, t: string) {
    await navigator.clipboard.writeText(t);
    setCopiado(i); setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-soft text-coral"><Sparkles className="h-5 w-5" aria-hidden /></span> Mensajes de difusión con IA</DialogTitle>
          <DialogDescription>Cuente a quién quiere llegar y qué busca lograr. La IA redacta un borrador por canal; revíselo antes de publicarlo.</DialogDescription>
        </DialogHeader>

        {campanas.length === 0 ? <p className="text-sm text-muted-foreground">Primero registre una campaña.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <Field id="d-campana" label="Campaña" required>
              <select id="d-campana" value={idSel} onChange={(e) => setCampanaId(e.target.value)} className={inputCls}>
                {campanas.map((x) => <option key={x.id} value={String(x.id)}>{x.nombre}</option>)}
              </select>
            </Field>
            <Field id="objetivos" label="Objetivos" required>
              <textarea id="objetivos" name="objetivos" rows={3} maxLength={1500} placeholder="Ej. Medir la presión arterial a 300 adultos y orientar a quienes tengan valores altos." className={`${inputCls} h-auto py-2`} />
            </Field>
            <Field id="publico" label="Público" required>
              <textarea id="publico" name="publico" rows={2} maxLength={800} placeholder="Ej. Adultos mayores de 40 años del área rural, muchos hablan k'iche'." className={`${inputCls} h-auto py-2`} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Canales</legend>
              <div className="flex flex-wrap gap-2">
                {CANALES.map((k) => <FilterChip key={k} active={canales.includes(k)} onClick={() => setCanales(canales.includes(k) ? canales.filter((x) => x !== k) : [...canales, k])}>{k}</FilterChip>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Tono</legend>
              <div className="flex flex-wrap gap-2">{TONOS.map((t) => <FilterChip key={t} active={tono === t} onClick={() => setTono(t)}>{t}</FilterChip>)}</div>
            </fieldset>
            {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={cargando}>{cargando ? <Loader2 className="animate-spin" /> : <Sparkles />} {cargando ? "Redactando…" : mensajes.length ? "Redactar de nuevo" : "Redactar mensajes"}</Button>
            </div>
          </form>
        )}

        {mensajes.length > 0 && (
          <div className="space-y-3" aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className="rounded-2xl border bg-muted/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display font-bold">{m.canal}</p>
                  <Button variant="ghost" size="sm" onClick={() => copiar(i, m.texto)}>{copiado === i ? <><Check /> Copiado</> : <><Copy /> Copiar</>}</Button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.texto}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
