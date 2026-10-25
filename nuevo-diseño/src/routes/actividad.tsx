import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { AppShell } from "@/components/sisg/AppShell";
import { acciones, describir, quien, Timeline } from "@/components/sisg/Timeline";
import { Card, EmptyState, FilterChip, inputCls, ListSkeleton, PageHeader } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { aCSV, exportarAuditado, fechaArchivo } from "@/lib/exportar";
import { api, fmtNum, ROLES, useSession, veAuditoria, type Accion } from "@/lib/api";

export const Route = createFileRoute("/actividad")({
  head: () => ({
    meta: [
      { title: "Auditoría · SISG Grupo 4" },
      { name: "description", content: "Quién hizo qué y cuándo en su entidad." },
      { property: "og:title", content: "Auditoría · SISG Grupo 4" },
      { property: "og:description", content: "Quién hizo qué y cuándo en su entidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Actividad /></AppShell>,
});

type Tipo = "" | "datos" | "seguridad";
const TIPOS: { k: Tipo; label: string }[] = [{ k: "", label: "Todo" }, { k: "datos", label: "Datos" }, { k: "seguridad", label: "Seguridad y usuarios" }];

/** Fecha local aaaa-mm-dd de un ISO, para comparar con los campos de fecha. */
const diaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Actividad() {
  const session = useSession()!;
  const permitido = veAuditoria(session);
  const q = useQuery({ queryKey: ["bitacora"], queryFn: api.bitacora, enabled: permitido });
  const [tipo, setTipo] = useState<Tipo>("");
  const [accion, setAccion] = useState<Accion | "">("");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  if (!permitido) return <Card><EmptyState title="No tiene acceso a la auditoría" text="Solo administradores y auditores pueden consultarla." /></Card>;

  const lista = q.data ?? [];
  const usuarios = [...new Map(lista.filter((m) => m.usuario).map((m) => [m.usuario!.id, m.usuario!])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const filtrados = lista.filter((m) => {
    const d = diaLocal(m.creadoEn);
    const seg = !!acciones[m.accion]?.seguridad;
    return (!tipo || (tipo === "seguridad") === seg) && (!accion || m.accion === accion)
      && (!usuario || String(m.usuario?.id ?? "") === usuario) && (!desde || d >= desde) && (!hasta || d <= hasta);
  });
  const hayFiltros = tipo || accion || usuario || desde || hasta;

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Quién hizo qué y cuándo: los últimos 500 movimientos de su entidad. Solo lectura; nunca guarda los valores de los datos de salud."
        actions={<Button variant="outline" disabled={!filtrados.length} onClick={() => exportarAuditado("bitacora", filtrados.length, aCSV(filtrados, [
          { titulo: "fecha", valor: (m) => new Date(m.creadoEn).toLocaleString("es-GT") }, { titulo: "usuario", valor: (m) => m.usuario?.nombre },
          { titulo: "correo", valor: (m) => m.usuario?.correo }, { titulo: "rol", valor: (m) => (m.usuario ? ROLES[m.usuario.rol].label : "") },
          { titulo: "accion", valor: (m) => acciones[m.accion]?.label ?? m.accion }, { titulo: "descripcion", valor: (m) => describir(m) },
          { titulo: "registro", valor: (m) => m.registroId }, { titulo: "responsable", valor: (m) => quien(m) },
        ]), `auditoria_${fechaArchivo()}.csv`)}><Download /> Exportar CSV</Button>} />
      <Card className="mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((x) => <FilterChip key={x.k} active={tipo === x.k} onClick={() => { setTipo(x.k); setAccion(""); }}>{x.label}</FilterChip>)}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1 sm:w-auto"><label htmlFor="accion" className="text-xs font-semibold text-muted-foreground">Acción</label>
            <select id="accion" value={accion} onChange={(e) => setAccion(e.target.value as Accion | "")} className={`${inputCls} h-10 w-full sm:w-auto`}>
              <option value="">Todas</option>
              {(Object.keys(acciones) as Accion[]).filter((k) => !tipo || (tipo === "seguridad") === !!acciones[k].seguridad).map((k) => <option key={k} value={k}>{acciones[k].label}</option>)}
            </select></div>
          <div className="w-full space-y-1 sm:w-auto"><label htmlFor="usuario" className="text-xs font-semibold text-muted-foreground">Usuario</label>
            <select id="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} className={`${inputCls} h-10 w-full sm:w-auto`}>
              <option value="">Todos</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select></div>
          <div className="w-full space-y-1 sm:w-auto"><label htmlFor="desde" className="text-xs font-semibold text-muted-foreground">Desde</label><input id="desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={`${inputCls} h-10 w-full sm:w-auto`} /></div>
          <div className="w-full space-y-1 sm:w-auto"><label htmlFor="hasta" className="text-xs font-semibold text-muted-foreground">Hasta</label><input id="hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={`${inputCls} h-10 w-full sm:w-auto`} /></div>
          {hayFiltros && <Button variant="ghost" size="sm" onClick={() => { setTipo(""); setAccion(""); setUsuario(""); setDesde(""); setHasta(""); }}><X /> Limpiar</Button>}
        </div>
      </Card>

      <Card>
        {q.isLoading && <ListSkeleton />}
        {q.isError && <EmptyState error title="No pudimos cargar la auditoría" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && lista.length === 0 && <EmptyState title="Aún no hay movimientos" text="Aquí verá cada registro, cambio, importación e inicio de sesión de su equipo." />}
        {q.data && lista.length > 0 && filtrados.length === 0 && <EmptyState title="Sin resultados" text="No hay movimientos con esos filtros." />}
        {filtrados.length > 0 && <>
          <p className="mb-4 text-sm text-muted-foreground">{fmtNum(filtrados.length)} {filtrados.length === 1 ? "movimiento" : "movimientos"}</p>
          <Timeline items={filtrados} />
        </>}
      </Card>
    </>
  );
}
