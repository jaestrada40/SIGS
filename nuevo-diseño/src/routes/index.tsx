import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Check, Copy, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Timer } from "lucide-react";
import { api, ApiError, esSuperadmin, setSession, useSession, type AuthResponse, type MfaConfig, type PasoAcceso } from "@/lib/api";
import { Logo } from "@/components/sisg/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ilustracion from "@/assets/ilustracion-cuidado.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión · SISG Grupo 4" },
      { name: "description", content: "Acceso para centros de diagnóstico y organismos no lucrativos del Sistema Integral de Salud de Guatemala." },
      { property: "og:title", content: "SISG · Un solo registro para la salud de Guatemala" },
      { property: "og:description", content: "Registre pacientes, estudios diagnósticos y campañas de salud en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { invitacion?: string } => (typeof s["invitacion"] === "string" ? { invitacion: s["invitacion"] } : {}),
  component: Acceso,
});

const field = "h-11 w-full rounded-xl border bg-card px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary";

function Campo({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function fortaleza(p: string) {
  let s = 0;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return s;
}
const niveles = [
  { label: "Muy débil", cls: "bg-destructive" },
  { label: "Débil", cls: "bg-coral" },
  { label: "Aceptable", cls: "bg-amber" },
  { label: "Buena", cls: "bg-primary-glow" },
  { label: "Excelente", cls: "bg-primary" },
];

const CLAVE_CORREO = "sisg.correo";
const correoGuardado = () => { try { return localStorage.getItem(CLAVE_CORREO) ?? ""; } catch { return ""; } };

function Acceso() {
  const session = useSession();
  const navigate = useNavigate();
  const { invitacion } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<PasoAcceso | null>(null);
  const [ver, setVer] = useState(false);
  const [recordado] = useState(correoGuardado);
  const [recordar, setRecordar] = useState(() => recordado !== "");
  const f = useMemo(() => fortaleza(password), [password]);
  // Con un enlace de invitación el formulario crea la contraseña de la entidad en lugar de iniciar sesión.
  const inv = useQuery({ queryKey: ["invitacion", invitacion], queryFn: () => api.invitacion(invitacion!), enabled: !!invitacion, retry: false });

  useEffect(() => { if (session) navigate({ to: esSuperadmin(session) ? "/plataforma" : "/inicio" }); }, [session, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const correo = String(new FormData(e.currentTarget).get("correo") ?? "").trim();
    if (invitacion && password.length < 10) { setError("La contraseña debe tener al menos 10 caracteres."); return; }
    setLoading(true);
    try {
      const res: PasoAcceso = invitacion ? await api.aceptarInvitacion(invitacion, password) : await api.login({ correo, password });
      if (!invitacion) { try { recordar ? localStorage.setItem(CLAVE_CORREO, correo) : localStorage.removeItem(CLAVE_CORREO); } catch { /* sin almacenamiento: no se recuerda */ } }
      setPassword("");
      setPaso(res);
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 401 ? "Correo o contraseña incorrectos." : err.message) : "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-hero px-6 py-10 text-primary-foreground lg:p-10">
        <div className="hidden lg:block"><Logo inverted /></div>
        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-6 rounded-[2rem] bg-card/95 p-4 shadow-2xl lg:mb-8 lg:p-6">
            <img src={ilustracion} alt="Manos sosteniendo un corazón con estetoscopio y lupa" width={1024} height={1024} className="h-32 w-32 object-contain lg:h-64 lg:w-64" />
          </div>
          <h1 className="font-display text-2xl font-extrabold leading-tight lg:text-4xl">Un solo registro para la salud de Guatemala</h1>
          <p className="mt-4 text-primary-foreground/85">Pacientes, estudios diagnósticos y campañas de salud, ordenados y seguros en un mismo lugar.</p>
        </div>
        <p className="hidden text-xs text-primary-foreground/70 lg:block">SISG · Módulo Grupo 4 · Centros de diagnóstico y organismos no lucrativos</p>
      </section>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          {paso ? <PasoMfa paso={paso} volver={() => setPaso(null)} /> : invitacion && inv.isError ? (<>
          <h2 className="text-3xl font-extrabold">Invitación no válida</h2>
          <p className="mt-1 text-muted-foreground">El enlace no existe, ya se usó o venció. Pida uno nuevo a quien administra la plataforma.</p>
          <Button className="mt-6" variant="outline" asChild><a href="/">Ir a iniciar sesión</a></Button>
          </>) : (<>
          <h2 className="text-3xl font-extrabold">{invitacion ? "Cree su contraseña" : "Bienvenido de vuelta"}</h2>
          <p className="mt-1 text-muted-foreground">{invitacion ? (inv.data ? `Acceso de ${inv.data.entidad}. Después configurará la verificación en dos pasos.` : "Verificando la invitación…") : "Ingrese con el correo de su entidad."}</p>

          <form onSubmit={onSubmit} className="surface mt-6 space-y-4 p-6">
            <Campo id="correo" label="Correo electrónico">
              <input id="correo" name="correo" type="email" required autoComplete="email" readOnly={!!invitacion} key={invitacion ? inv.data?.correo : "login"}
                defaultValue={invitacion ? inv.data?.correo : recordado} className={field} placeholder="contacto@entidad.gt" />
            </Campo>
            <Campo id="password" label={invitacion ? "Nueva contraseña" : "Contraseña"}>
              <div className="relative">
                <input id="password" name="password" type={ver ? "text" : "password"} required minLength={invitacion ? 10 : undefined}
                  autoComplete={invitacion ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={cn(field, "pr-11")} />
                <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={ver}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
                  {ver ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </Campo>
            {!invitacion && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /> Recordar mi correo</label>
            )}
            {invitacion && password && (
              <div aria-live="polite">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < f ? niveles[f]!.cls : "bg-muted")} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Fortaleza: <strong className="text-foreground">{niveles[f]!.label}</strong>{password.length < 10 && " · mínimo 10 caracteres"}</p>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm text-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading || (!!invitacion && !inv.data)}>
              {loading && <Loader2 className="animate-spin" aria-hidden />}
              {invitacion ? "Crear contraseña" : "Iniciar sesión"}
            </Button>
          </form>
          </>)}
        </div>
      </section>
    </div>
  );
}

const copiar = (s: string) => navigator.clipboard?.writeText(s).catch(() => undefined);

// Segundo paso del acceso: código de la app autenticadora, o configuración obligatoria la primera vez.
/** Segundos que quedan de la verificación. La duración (exp − iat) sale del propio token y se cuenta desde que llegó, así no depende del reloj del navegador. */
function useCuentaRegresiva(token: string) {
  const [fin] = useState(() => {
    try { const p = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))); return Date.now() + (p.exp - p.iat) * 1000; }
    catch { return Date.now() + 300_000; }
  });
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const restante = Math.max(0, Math.ceil((fin - ahora) / 1000));
  // Los códigos de la app cambian en cada múltiplo de 30 s del reloj.
  return { restante, vencido: restante === 0, cicloApp: 30 - (Math.floor(ahora / 1000) % 30) };
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function PasoMfa({ paso, volver }: { paso: PasoAcceso; volver: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<MfaConfig | null>(null);
  const [entregado, setEntregado] = useState<(AuthResponse & { recuperacion: string[] }) | null>(null);
  const [guardados, setGuardados] = useState(false);
  const configurar = paso.estado === "mfa_configurar";
  const { restante, vencido, cicloApp } = useCuentaRegresiva(paso.estado === "mfa_configurar" ? paso.setup_token : paso.mfa_token);

  useEffect(() => {
    if (paso.estado !== "mfa_configurar") return;
    api.mfaConfigurar(paso.setup_token).then(setConfig).catch((e) => setError(e instanceof ApiError ? e.message : "No pudimos generar el código QR."));
  }, [paso]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (vencido) return;
    setError(null); setLoading(true);
    try {
      if (paso.estado === "mfa_requerido") {
        const r = await api.mfaVerificar({ mfa_token: paso.mfa_token, codigo: codigo.trim() });
        setSession({ entidad: r.entidad, usuario: r.usuario });
      } else {
        setEntregado(await api.mfaActivar(paso.setup_token, codigo.trim()));
      }
    } catch (err) {
      setError(err instanceof ApiError
        ? err.status === 401 ? "Código incorrecto o vencido. Revise la hora de su teléfono e intente de nuevo." : err.message
        : "Ocurrió un error inesperado.");
    } finally { setLoading(false); }
  }

  if (entregado) {
    return (
      <>
        <h2 className="text-3xl font-extrabold">Guarde sus códigos de recuperación</h2>
        <p className="mt-1 text-muted-foreground">Si pierde su teléfono, cada código le permite entrar una sola vez. No volverán a mostrarse.</p>
        <div className="surface mt-6 space-y-4 p-6">
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm font-semibold">
            {entregado.recuperacion.map((c) => <li key={c} className="rounded-xl bg-secondary px-3 py-2 text-center">{c}</li>)}
          </ul>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => copiar(entregado.recuperacion.join("\n"))}><Copy /> Copiar códigos</Button>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={guardados} onChange={(e) => setGuardados(e.target.checked)} className="mt-1" /> Ya los guardé en un lugar seguro.</label>
          <Button type="button" size="lg" className="w-full" disabled={!guardados} onClick={() => setSession({ entidad: entregado.entidad, usuario: entregado.usuario })}><Check /> Continuar</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={volver} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> Volver</button>
      <h2 className="text-3xl font-extrabold">{configurar ? "Active la verificación en dos pasos" : "Verifique que es usted"}</h2>
      <p className="mt-1 text-muted-foreground">{configurar ? "Protege los datos de salud de sus pacientes. Es obligatoria para todas las entidades." : "Abra su app autenticadora e ingrese el código de 6 dígitos."}</p>
      <form onSubmit={enviar} className="surface mt-6 space-y-4 p-6">
        {configurar && (
          <div className="space-y-3 text-sm">
            <p><strong>1.</strong> Escanee el código con Google Authenticator, Microsoft Authenticator o similar.</p>
            <div className="flex justify-center rounded-2xl bg-white p-3">
              {config ? <img src={config.qr} alt="Código QR para la app autenticadora" width={240} height={240} className="h-48 w-48" /> : <Loader2 className="my-16 animate-spin text-primary" aria-label="Generando código QR" />}
            </div>
            {config && <p className="text-xs text-muted-foreground">¿No puede escanear? Escriba esta clave: <span className="select-all break-all font-mono font-semibold text-foreground">{config.secreto}</span></p>}
            <p><strong>2.</strong> Ingrese el código de 6 dígitos que muestra la app.</p>
          </div>
        )}
        <div role="timer" aria-live="off" className={cn("rounded-xl border px-3 py-2 text-sm transition-colors", vencido || restante <= 30 ? "border-destructive/40 bg-coral-soft" : "bg-secondary")}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium"><Timer className="h-4 w-4" aria-hidden /> {vencido ? "Tiempo agotado" : "Tiempo para ingresar el código"}</span>
            <strong className="tabular">{mmss(restante)}</strong>
          </div>
          {!vencido && <p className="mt-1 text-xs text-muted-foreground">El código de su app cambia en {cicloApp} s.</p>}
        </div>
        <Campo id="codigo" label={configurar ? "Código de 6 dígitos" : "Código"} {...(configurar ? {} : { hint: "También puede usar un código de recuperación." })}>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input id="codigo" required autoFocus inputMode={configurar ? "numeric" : "text"} autoComplete="one-time-code" maxLength={20}
              value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={vencido} className={cn(field, "pl-9 font-mono tracking-widest")} placeholder="123456" />
          </div>
        </Campo>
        {vencido ? (
          <div role="alert" className="space-y-3 rounded-xl bg-coral-soft p-3 text-sm text-foreground">
            <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>El tiempo venció. Vuelva a iniciar sesión para recibir una nueva verificación.</span></div>
            <Button type="button" variant="outline" size="sm" onClick={volver}><ArrowLeft /> Volver a iniciar sesión</Button>
          </div>
        ) : error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-coral-soft p-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden /><span>{error}</span>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading || vencido || (configurar && !config)}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck />}
          {configurar ? "Activar y entrar" : "Verificar"}
        </Button>
      </form>
    </>
  );
}
