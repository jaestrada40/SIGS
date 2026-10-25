import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/sisg/AppShell";
import { acciones, describir } from "@/components/sisg/Timeline";
import { Card, EmptyState, FilterChip, IconChip, ListSkeleton, PageHeader } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { api, esSuperadmin, ROLES, tiempoRelativo, useSession } from "@/lib/api";

export const Route = createFileRoute("/seguridad")({
  head: () => ({
    meta: [
      { title: "Seguridad · SISG Grupo 4" },
      { name: "description", content: "Eventos de cuentas y de seguridad de todas las entidades." },
    ],
  }),
  component: () => <AppShell><Seguridad /></AppShell>,
});

type Filtro = "todo" | "alertas" | "plataforma";
const alerta = new Set(["BLOQUEO", "ACCESO_FALLIDO", "EXPORTAR", "DESACTIVAR", "SUSPENDER"]);

function Seguridad() {
  const session = useSession()!;
  const q = useQuery({ queryKey: ["seguridad"], queryFn: api.auditoriaPlataforma, enabled: esSuperadmin(session) });
  const [filtro, setFiltro] = useState<Filtro>("todo");
  if (!esSuperadmin(session)) return <Card><EmptyState title="No tiene acceso a esta sección" text="Solo el superadministrador ve la seguridad de la plataforma." /></Card>;

  const lista = (q.data ?? []).filter((m) => filtro === "todo" || (filtro === "alertas" ? alerta.has(m.accion) : m.usuario?.rol === "SUPERADMIN"));
  return (
    <>
      <PageHeader title="Seguridad" subtitle="Altas, accesos, bloqueos y acciones sobre cuentas en todas las entidades: los últimos 300 eventos. Nunca incluye datos de pacientes." />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar eventos">
        <FilterChip active={filtro === "todo"} onClick={() => setFiltro("todo")}>Todo</FilterChip>
        <FilterChip active={filtro === "alertas"} onClick={() => setFiltro("alertas")}>Alertas</FilterChip>
        <FilterChip active={filtro === "plataforma"} onClick={() => setFiltro("plataforma")}>Acciones del superadmin</FilterChip>
      </div>
      <Card>
        {q.isLoading && <ListSkeleton />}
        {q.isError && <EmptyState error title="No pudimos cargar los eventos" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && lista.length === 0 && <EmptyState title="Sin eventos" text="No hay eventos para este filtro." />}
        {lista.length > 0 && (
          <ul className="divide-y">
            {lista.map((m) => {
              const a = acciones[m.accion] ?? acciones.CREAR;
              return (
                <li key={m.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <IconChip icon={a.icon} tone={a.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{describir(m)}{m.objetivo && <span className="font-semibold"> · {m.objetivo}</span>}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.entidad ?? "Sin entidad"}
                      {m.usuario && <> · <span title={m.usuario.correo}>{m.usuario.nombre} ({ROLES[m.usuario.rol].label})</span></>}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={m.creadoEn} title={new Date(m.creadoEn).toLocaleString("es-GT")}>{tiempoRelativo(m.creadoEn)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
