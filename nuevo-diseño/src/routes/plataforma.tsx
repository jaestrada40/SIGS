import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ban, Building2, CheckCircle2, Download, Hourglass, ShieldAlert, ShieldOff, Users, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/sisg/AppShell";
import { Card, EmptyState, IconChip, PageHeader, Skeleton, useCountUp, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { api, esSuperadmin, fmtNum, useSession } from "@/lib/api";

export const Route = createFileRoute("/plataforma")({
  head: () => ({
    meta: [
      { title: "Plataforma · SISG Grupo 4" },
      { name: "description", content: "Estado de las entidades y de la seguridad de la plataforma." },
    ],
  }),
  component: () => <AppShell><Resumen /></AppShell>,
});

function Cifra({ icon, tone, label, value, detalle }: { icon: LucideIcon; tone: Tono; label: string; value: number; detalle?: string }) {
  const v = useCountUp(value);
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconChip icon={icon} tone={tone} />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 font-display text-4xl font-extrabold">{fmtNum(v)}</p>
      {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
    </Card>
  );
}

function Resumen() {
  const session = useSession()!;
  const q = useQuery({ queryKey: ["resumen-plataforma"], queryFn: api.resumenPlataforma, enabled: esSuperadmin(session) });
  if (!esSuperadmin(session)) return <Card><EmptyState title="No tiene acceso a esta sección" text="Solo el superadministrador ve el estado de la plataforma." /></Card>;
  const r = q.data;

  // Lo que pide una acción de quien administra la plataforma, en orden de urgencia.
  const atencion = r ? [
    r.entidades.suspendidas > 0 && { to: "/entidades", tone: "coral" as Tono, texto: `${r.entidades.suspendidas} ${r.entidades.suspendidas === 1 ? "entidad suspendida" : "entidades suspendidas"}`, boton: "Ver entidades" },
    r.seguridad.bloqueos7d > 0 && { to: "/seguridad", tone: "coral" as Tono, texto: `${r.seguridad.bloqueos7d} ${r.seguridad.bloqueos7d === 1 ? "cuenta bloqueada" : "cuentas bloqueadas"} por intentos fallidos en 7 días`, boton: "Ver seguridad" },
    r.entidades.pendientes > 0 && { to: "/entidades", tone: "amber" as Tono, texto: `${r.entidades.pendientes} ${r.entidades.pendientes === 1 ? "entidad no ha activado" : "entidades no han activado"} su acceso`, boton: "Ver entidades" },
    r.usuarios.sinMfa > 0 && { to: "/cuentas", tone: "amber" as Tono, texto: `${r.usuarios.sinMfa} ${r.usuarios.sinMfa === 1 ? "usuario activo sin" : "usuarios activos sin"} verificación en dos pasos`, boton: "Ver usuarios" },
  ].filter(Boolean) as { to: string; tone: Tono; texto: string; boton: string }[] : [];

  return (
    <>
      <PageHeader title="Plataforma" subtitle="Estado de las entidades y de la seguridad. Aquí no se ven datos de pacientes." />
      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-32" />)}</div>}
      {q.isError && <Card><EmptyState error title="No pudimos cargar el resumen" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} /></Card>}
      {r && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Cifra icon={Building2} tone="teal" label="Entidades" value={r.entidades.total} detalle={`${r.entidades.centros} centros · ${r.entidades.organismos} organismos`} />
            <Cifra icon={CheckCircle2} tone="teal" label="Activas" value={r.entidades.activas} />
            <Cifra icon={Hourglass} tone="amber" label="Sin activar" value={r.entidades.pendientes} detalle="Invitación pendiente o vencida" />
            <Cifra icon={Ban} tone="coral" label="Suspendidas" value={r.entidades.suspendidas} />
            <Cifra icon={Users} tone="blue" label="Usuarios activos" value={r.usuarios.activos} detalle={`${r.usuarios.total} en total · ${r.usuarios.superadmins} ${r.usuarios.superadmins === 1 ? "superadmin" : "superadmins"}`} />
            <Cifra icon={ShieldOff} tone="amber" label="Sin MFA" value={r.usuarios.sinMfa} detalle="Usuarios activos sin verificación en dos pasos" />
            <Cifra icon={ShieldAlert} tone="coral" label="Bloqueos (7 días)" value={r.seguridad.bloqueos7d} detalle="Por intentos fallidos de acceso" />
            <Cifra icon={Download} tone="blue" label="Exportaciones (7 días)" value={r.seguridad.exportaciones7d} detalle="Descargas de datos registradas" />
          </div>

          <Card className="mt-6">
            <h2 className="mb-3 text-lg font-bold">Requiere atención</h2>
            {atencion.length === 0
              ? <p className="text-sm text-muted-foreground">Nada pendiente: todas las entidades están activas y sin alertas de seguridad.</p>
              : <ul className="divide-y">
                {atencion.map((a) => (
                  <li key={a.texto} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex items-center gap-2 text-sm font-medium"><span className={`h-2 w-2 rounded-full ${a.tone === "coral" ? "bg-coral" : "bg-amber"}`} aria-hidden />{a.texto}</span>
                    <Button variant="outline" size="sm" asChild><Link to={a.to}>{a.boton}</Link></Button>
                  </li>
                ))}
              </ul>}
          </Card>
        </>
      )}
    </>
  );
}
