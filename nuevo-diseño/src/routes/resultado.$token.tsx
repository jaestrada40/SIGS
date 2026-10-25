import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/sisg/AppShell";
import { Button } from "@/components/ui/button";
import { api, ApiError, fmtFecha, type ResultadoPublico } from "@/lib/api";

export const Route = createFileRoute("/resultado/$token")({
  head: () => ({
    meta: [
      { title: "Su resultado · SISG" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Resultado,
});

const campo = "h-11 w-full rounded-xl border bg-card px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary";

function Resultado() {
  const { token } = Route.useParams();
  const [porDpi, setPorDpi] = useState(false);   // el centro puede no tener la fecha de nacimiento: entonces sirven los 4 últimos dígitos del DPI
  const [dato, setDato] = useState("");
  const [r, setR] = useState<ResultadoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault(); setError(null); setCargando(true);
    try { setR(await api.verResultado(token, dato.trim())); }
    catch (e) { setError(e instanceof ApiError ? e.message : "No pudimos verificar sus datos. Intente de nuevo."); }
    finally { setCargando(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      {!r ? (
        <form onSubmit={enviar} className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
          <div>
            <h1 className="font-display text-2xl font-extrabold">Ver mi resultado</h1>
            <p className="mt-1 text-sm text-muted-foreground">Para proteger su información, confirme que es usted.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dato" className="text-sm font-semibold">{porDpi ? "Últimos 4 dígitos de su DPI" : "Su fecha de nacimiento"}</label>
            {porDpi
              ? <input key="dpi" id="dato" value={dato} onChange={(x) => setDato(x.target.value.replace(/\D/g, "").slice(0, 4))} required autoComplete="off" inputMode="numeric" maxLength={4} placeholder="0000" className={campo} />
              : <input key="fecha" id="dato" type="date" value={dato} onChange={(x) => setDato(x.target.value)} required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} className={campo} />}
            <button type="button" className="text-xs text-primary underline underline-offset-2" onClick={() => { setPorDpi(!porDpi); setDato(""); setError(null); }}>
              {porDpi ? "Usar mi fecha de nacimiento" : "El centro no tiene mi fecha: usar los últimos 4 dígitos de mi DPI"}
            </button>
          </div>
          {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={cargando}>{cargando && <Loader2 className="animate-spin" />} Ver resultado</Button>
        </form>
      ) : (
        <article className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" aria-hidden /> Identidad confirmada</p>
          <div>
            <h1 className="font-display text-2xl font-extrabold">{r.tipoEstudio}</h1>
            <p className="text-sm text-muted-foreground">{r.paciente} · {fmtFecha(r.fecha)} · {r.centro}</p>
          </div>
          <p className="whitespace-pre-wrap rounded-2xl bg-accent/50 p-4 text-sm leading-relaxed">{r.resultado}</p>
          <p className="text-xs text-muted-foreground">Este resultado no sustituye la consulta con su médico. Por su seguridad no comparta este enlace; vence el {fmtFecha(r.expiraEn.slice(0, 10))}.</p>
        </article>
      )}
    </main>
  );
}
