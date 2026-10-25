import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CloudOff, Lock, LockOpen, Loader2, RefreshCw, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { Ubicacion } from "@/components/sisg/Ubicacion";
import { Card, EmptyState, Field, inputCls, PageHeader, Tag } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { api, esCentro, puedeEscribir, useSession, type Campana, type Geografia, type Sexo } from "@/lib/api";
import { contarPendientes, crearClave, desbloquear, encolar, listar, MIN_CLAVE, quitar, sincronizar, tieneClave, type ItemJornada } from "@/lib/offline";
import { limpiarTelefono, TELEFONO_GT } from "@/lib/telefono";

export const Route = createFileRoute("/jornada")({
  head: () => ({
    meta: [
      { title: "Jornada · SISG Grupo 4" },
      { name: "description", content: "Registre personas atendidas en una jornada, con o sin conexión a internet." },
      { property: "og:title", content: "Jornada · SISG Grupo 4" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Jornada /></AppShell>,
});

const CACHE = "sisg-jornada-v1";   // el mismo nombre que usa public/sw.js
type CampanaCorta = Pick<Campana, "id" | "nombre">;
// Lo que se necesita para llenar el formulario sin señal. No incluye datos de personas.
const guardado = <T,>(k: string): T | undefined => { try { return JSON.parse(localStorage.getItem(k) ?? "null") ?? undefined; } catch { return undefined; } };
const guardar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio o bloqueado: solo se pierde el acceso sin señal */ } };

function Jornada() {
  const session = useSession()!;
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [clave, setClave] = useState<CryptoKey | null>(null);
  const [hayClave, setHayClave] = useState<boolean | null>(null);
  const [pend, setPend] = useState(0);
  const [lista, setLista] = useState<{ id: string; item: ItemJornada; error?: string }[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [listoOffline, setListoOffline] = useState(false);
  const [campanaId, setCampanaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);   // cambia al guardar para limpiar el formulario y la ubicación
  const ocupado = useRef(false);

  const camp = useQuery({
    queryKey: ["campanas"], queryFn: api.campanas, enabled: !esCentro(session.entidad),
    initialData: () => guardado<Campana[]>("sisg.jornada.campanas"), initialDataUpdatedAt: 0,
  });
  const geo = useQuery({ queryKey: ["geografia"], queryFn: api.geografia, staleTime: Infinity, initialData: () => guardado<Geografia>("sisg.jornada.geo"), initialDataUpdatedAt: 0 });
  useEffect(() => { if (camp.data && camp.isFetchedAfterMount) guardar("sisg.jornada.campanas", camp.data.map(({ id, nombre }): CampanaCorta => ({ id, nombre }))); }, [camp.data, camp.isFetchedAfterMount]);
  useEffect(() => { if (geo.data && geo.isFetchedAfterMount) guardar("sisg.jornada.geo", geo.data); }, [geo.data, geo.isFetchedAfterMount]);
  const campanas: CampanaCorta[] = camp.data ?? [];
  useEffect(() => { if (!campanaId && campanas[0]) setCampanaId(String(campanas[0].id)); }, [campanas, campanaId]);
  const nombreCampana = (id: number) => campanas.find((c) => c.id === id)?.nombre ?? `Campaña ${id}`;

  useEffect(() => {
    const on = () => setEnLinea(true), off = () => setEnLinea(false);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  // Deja guardados en el dispositivo la página y sus archivos para poder abrirla sin señal.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const c = await caches.open(CACHE);
        await c.add("/jornada");
        const archivos = performance.getEntriesByType("resource").map((r) => new URL(r.name)).filter((u) => u.origin === location.origin && u.pathname.startsWith("/assets/")).map((u) => u.pathname + u.search);
        await Promise.all(archivos.map(async (u) => { if (!(await c.match(u))) await c.add(u); }));
        setListoOffline(archivos.length > 0);
      } catch { /* sin service worker la pantalla sigue funcionando con conexión */ }
    })();
  }, []);

  useEffect(() => { void tieneClave().then(setHayClave); void contarPendientes().then(setPend); }, []);

  const refrescar = useCallback(async (k: CryptoKey | null) => { setPend(await contarPendientes()); if (k) setLista(await listar(k)); }, []);
  const enviar = useCallback(async (k: CryptoKey) => {
    if (ocupado.current || !navigator.onLine) return;
    ocupado.current = true; setSincronizando(true);
    try {
      const r = await sincronizar(k);
      const ok = r.enviados + r.yaEstaban + r.repetidos;
      if (ok) toast.success(`Sincronizado: ${ok} ${ok === 1 ? "registro" : "registros"}${r.repetidos ? ` (${r.repetidos} ya estaban en la campaña)` : ""}`);
      if (r.conError) toast.error(`${r.conError} ${r.conError === 1 ? "registro fue rechazado" : "registros fueron rechazados"}. Revíselos abajo.`);
      if (r.detenido && r.detenido !== "Sin conexión") toast.error(r.detenido);
      await refrescar(k);
    } finally { ocupado.current = false; setSincronizando(false); }
  }, [refrescar]);
  useEffect(() => { if (clave && enLinea) void enviar(clave); }, [clave, enLinea, enviar]);
  useEffect(() => { if (clave) void refrescar(clave); }, [clave, refrescar]);

  if (esCentro(session.entidad) || !puedeEscribir(session)) {
    return <Card><EmptyState title="Esta pantalla no está disponible" text="Las jornadas son de los organismos no lucrativos, con rol de Administrador u Operador." /></Card>;
  }

  async function guardarAtencion(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault(); setError(null);
    if (!clave) return;
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const paciente: ItemJornada["paciente"] = { nombreCompleto: g("nombreCompleto"), sexo: (g("sexo") || "NE") as Sexo };
    for (const k of ["dpi", "fechaNacimiento", "departamento", "municipio", "telefono"] as const) { const v = g(k); if (v) paciente[k] = v; }
    if (!campanaId) { setError("Elija la campaña."); return; }
    if (!paciente.nombreCompleto) { setError("Escriba el nombre completo."); return; }
    if (paciente.dpi && !/^\d{13}$/.test(paciente.dpi)) { setError("El DPI debe tener exactamente 13 dígitos."); return; }
    if (paciente.telefono && !TELEFONO_GT.test(limpiarTelefono(paciente.telefono))) { setError("El teléfono debe tener 8 dígitos, por ejemplo 5512 3456."); return; }
    if (paciente.municipio && !paciente.departamento) { setError("Elija primero el departamento."); return; }
    try {
      await encolar(clave, { claveCliente: crypto.randomUUID(), campanaId: Number(campanaId), atendidoEn: new Date().toISOString(), paciente });
    } catch { setError("No se pudo guardar en este dispositivo. Revise que tenga espacio y que el navegador permita almacenamiento."); return; }
    setN((x) => x + 1);
    await refrescar(clave);
    toast.success(navigator.onLine ? "Guardado. Enviando…" : "Guardado en este dispositivo. Se enviará cuando haya conexión.");
    void enviar(clave);
  }

  return (
    <>
      <PageHeader title="Jornada" subtitle="Registre a las personas atendidas. Sin señal se guardan cifradas en este dispositivo y se envían solas al volver la conexión."
        actions={<div className="flex flex-wrap items-center gap-2">
          <Tag tone={enLinea ? "teal" : "amber"}>{enLinea ? <><Wifi className="mr-1 inline h-3.5 w-3.5" aria-hidden />Con conexión</> : <><CloudOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />Sin conexión</>}</Tag>
          <Tag tone={pend ? "blue" : "teal"}>{pend} {pend === 1 ? "pendiente" : "pendientes"}</Tag>
        </div>} />

      {!listoOffline && enLinea && <p className="mb-4 text-sm text-muted-foreground">Preparando esta pantalla para usarla sin conexión…</p>}
      {listoOffline && <p className="mb-4 text-sm text-muted-foreground">Esta pantalla ya se puede abrir sin conexión en este dispositivo. Ábrala una vez con señal antes de salir a la jornada.</p>}

      {!clave ? (
        <Bloqueo hayClave={hayClave} pend={pend} onClave={setClave} />
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Nueva persona atendida</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setClave(null); setLista([]); }}><Lock /> Bloquear</Button>
            </div>
            {campanas.length === 0 ? <p className="text-sm text-muted-foreground">No hay campañas guardadas en este dispositivo. Abra esta pantalla con conexión para cargarlas, o cree una campaña primero.</p> : (
              <form onSubmit={guardarAtencion} className="space-y-3" key={n}>
                <Field id="campanaId" label="Campaña" required>
                  <select id="campanaId" name="campanaId" value={campanaId} onChange={(e) => setCampanaId(e.target.value)} className={inputCls}>
                    {campanas.map((c) => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                  </select>
                </Field>
                <Field id="nombreCompleto" label="Nombre completo" required><input id="nombreCompleto" name="nombreCompleto" required autoComplete="off" className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="sexo" label="Sexo">
                    <select id="sexo" name="sexo" defaultValue="" className={inputCls}><option value="">No especificado</option><option value="F">Femenino</option><option value="M">Masculino</option></select>
                  </Field>
                  <Field id="fechaNacimiento" label="Fecha de nacimiento"><input id="fechaNacimiento" name="fechaNacimiento" type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="dpi" label="DPI"><input id="dpi" name="dpi" inputMode="numeric" maxLength={13} placeholder="13 dígitos" className={inputCls} /></Field>
                  <Field id="telefono" label="Teléfono"><input id="telefono" name="telefono" type="tel" inputMode="tel" placeholder="5512 3456" className={inputCls} /></Field>
                </div>
                <Ubicacion depto="" municipio="" />
                {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
                <Button type="submit" className="w-full sm:w-auto">Guardar atención</Button>
              </form>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Pendientes de enviar</h2>
              <Button type="button" variant="outline" size="sm" disabled={!enLinea || !pend || sincronizando} onClick={() => void enviar(clave)}>
                {sincronizando ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sincronizar ahora
              </Button>
            </div>
            {lista.length === 0 ? <p className="text-sm text-muted-foreground">No hay nada pendiente. Todo lo registrado ya está en el servidor.</p> : (
              <ul className="divide-y">
                {lista.map(({ id, item, error: motivo }) => (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{item.paciente.nombreCompleto}</p>
                      <p className="text-xs text-muted-foreground">{nombreCampana(item.campanaId)} · {new Date(item.atendidoEn).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}</p>
                      {motivo && <p className="mt-1 text-xs text-coral">Rechazado: {motivo}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag tone={motivo ? "coral" : "blue"}>{motivo ? "Con error" : "Pendiente"}</Tag>
                      {motivo && <Button type="button" variant="ghost" size="sm" aria-label={`Descartar ${item.paciente.nombreCompleto}`} onClick={() => { void quitar(id).then(() => refrescar(clave)); }}><Trash2 /></Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function Bloqueo({ hayClave, pend, onClave }: { hayClave: boolean | null; pend: number; onClave: (k: CryptoKey) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault(); setError(null);
    const fd = new FormData(ev.currentTarget), c = String(fd.get("clave") ?? "");
    if (!hayClave && c !== String(fd.get("repetir") ?? "")) { setError("Las contraseñas no coinciden."); return; }
    setTrabajando(true);
    try { onClave(hayClave ? await desbloquear(c) : await crearClave(c)); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo continuar."); }
    finally { setTrabajando(false); }
  }
  if (hayClave === null) return <Card><Loader2 className="animate-spin" aria-label="Cargando" /></Card>;
  return (
    <Card>
      <form onSubmit={enviar} className="max-w-md space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">{hayClave ? <Lock className="h-5 w-5" aria-hidden /> : <LockOpen className="h-5 w-5" aria-hidden />} {hayClave ? "Desbloquear la jornada" : "Proteja los datos de este dispositivo"}</h2>
        <p className="text-sm text-muted-foreground">
          {hayClave
            ? `Escriba la contraseña de jornada para registrar personas${pend ? ` y enviar los ${pend} pendientes` : ""}.`
            : `Los registros se guardan cifrados con una contraseña que solo usted conoce (mínimo ${MIN_CLAVE} caracteres). No se puede recuperar: si la olvida, lo pendiente en este dispositivo se pierde.`}
        </p>
        <Field id="clave" label="Contraseña de jornada" required><input id="clave" name="clave" type="password" required minLength={hayClave ? 1 : MIN_CLAVE} autoComplete={hayClave ? "current-password" : "new-password"} className={inputCls} /></Field>
        {!hayClave && <Field id="repetir" label="Repita la contraseña" required><input id="repetir" name="repetir" type="password" required minLength={MIN_CLAVE} autoComplete="new-password" className={inputCls} /></Field>}
        {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
        <Button type="submit" disabled={trabajando}>{trabajando && <Loader2 className="animate-spin" />} {hayClave ? "Desbloquear" : "Crear contraseña"}</Button>
      </form>
    </Card>
  );
}
