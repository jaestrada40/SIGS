import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, FileSpreadsheet, FlaskConical, Megaphone, Plus, Sparkles, UserPlus, Users, HandHeart, type LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/sisg/AppShell";
import { Timeline } from "@/components/sisg/Timeline";
import { Card, EmptyState, IconChip, Skeleton, Sparkline, useCountUp, toneColor, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { api, esCentro, fmtNum, puedeEscribir, ROLES, saludo, useSession, veAuditoria, type DashboardCentro, type DashboardOrg, type Movimiento } from "@/lib/api";

export const Route = createFileRoute("/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio · SISG Grupo 4" },
      { name: "description", content: "Resumen de pacientes, estudios y campañas de su entidad." },
      { property: "og:title", content: "Inicio · SISG Grupo 4" },
      { property: "og:description", content: "Resumen de actividad de su entidad en el Sistema Integral de Salud de Guatemala." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Inicio /></AppShell>,
});

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function serie7dias(mov: Movimiento[], tabla: string) {
  const out = Array(7).fill(0);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  for (const m of mov) {
    if (!m.tabla.toLowerCase().startsWith(tabla)) continue;
    const d = new Date(m.creadoEn); d.setHours(0, 0, 0, 0);
    const idx = 6 - Math.round((hoy.getTime() - d.getTime()) / 86400000);
    if (idx >= 0 && idx < 7) out[idx] += m.accion === "IMPORTAR" ? m.detalle?.filas ?? 1 : 1;
  }
  return out;
}

function Stat({ label, value, icon, tone, spark }: { label: string; value: number; icon: LucideIcon; tone: Tono; spark: number[] }) {
  const v = useCountUp(value);
  return (
    <Card hover className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <IconChip icon={icon} tone={tone} />
        <Sparkline data={spark} tone={tone} />
      </div>
      <div>
        <p className="font-display text-3xl font-extrabold tabular">{fmtNum(v)}</p>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Inicio() {
  const session = useSession()!;
  const centro = esCentro(session.entidad);
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const bit = useQuery({ queryKey: ["bitacora"], queryFn: api.bitacora, enabled: veAuditoria(session) });   // el operador no tiene acceso a la auditoría
  const estudios = useQuery({ queryKey: ["estudios"], queryFn: api.estudios, enabled: centro });
  const campanas = useQuery({ queryKey: ["campanas"], queryFn: api.campanas, enabled: !centro });
  const mov = bit.data ?? [];

  const chart = useMemo(() => {
    if (centro) {
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, mes: MESES[d.getMonth()], total: 0 };
      });
      for (const e of estudios.data ?? []) {
        const m = months.find((x) => x.key === e.fecha?.slice(0, 7));
        if (m) m.total++;
      }
      return months;
    }
    const areas = [
      { k: "CARDIOVASCULAR", area: "Cardiovascular" }, { k: "RESPIRATORIA", area: "Respiratoria" },
      { k: "PLANIFICACION", area: "Planificación" }, { k: "ONCOLOGICO_OTRO", area: "Oncológico/otro" },
    ];
    return areas.map((a) => ({ area: a.area, total: (campanas.data ?? []).filter((c) => c.area === a.k).length }));
  }, [centro, estudios.data, campanas.data]);

  const escribe = puedeEscribir(session);
  const quick = [
    { to: "/pacientes", label: "Nuevo paciente", icon: UserPlus, tone: "teal" as Tono },
    centro
      ? { to: "/estudios", label: "Nuevo estudio", icon: FlaskConical, tone: "blue" as Tono }
      : { to: "/campanas", label: "Nueva campaña", icon: Megaphone, tone: "coral" as Tono },
    { to: "/pacientes", label: "Importar CSV", icon: FileSpreadsheet, tone: "amber" as Tono },
    { to: "/actividad", label: "Ver actividad", icon: Activity, tone: "blue" as Tono },
  ].filter((q) => (q.to === "/actividad" ? veAuditoria(session) : escribe || q.label.startsWith("Ver"))) as readonly {
    to: string; label: string; icon: LucideIcon; tone: Tono;
  }[];

  const d = dash.data;
  const stats: { label: string; value: number; icon: LucideIcon; tone: Tono; spark: number[] }[] = !d ? [] : centro
    ? [
        { label: "Pacientes registrados", value: (d as DashboardCentro).totalPacientes, icon: Users, tone: "teal", spark: serie7dias(mov, "paciente") },
        { label: "Estudios diagnósticos", value: (d as DashboardCentro).totalEstudios, icon: FlaskConical, tone: "blue", spark: serie7dias(mov, "estudio") },
      ]
    : [
        { label: "Pacientes registrados", value: (d as DashboardOrg).totalPacientes, icon: Users, tone: "teal", spark: serie7dias(mov, "paciente") },
        { label: "Campañas", value: (d as DashboardOrg).totalCampanas, icon: Megaphone, tone: "coral", spark: serie7dias(mov, "campana") },
        { label: "Personas atendidas", value: (d as DashboardOrg).totalPersonasAtendidas, icon: HandHeart, tone: "amber", spark: serie7dias(mov, "campana") },
      ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.5rem] bg-gradient-hero p-6 text-primary-foreground shadow-glow md:p-8">
        <div className="relative z-10 max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {centro ? "Centro de diagnóstico" : "Organismo no lucrativo"}
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold md:text-4xl">{saludo()}, {session.entidad.nombre}</h1>
          <p className="mt-2 text-primary-foreground/85">
            {centro ? "Tenga a la mano los estudios del día y mantenga al día los resultados de sus pacientes." : "Cada persona atendida cuenta. Registre los avances de sus campañas aquí."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {escribe && <Button variant="hero" asChild><Link to="/pacientes"><Plus /> Registrar paciente</Link></Button>}
            <Button variant="heroGhost" asChild><Link to={centro ? "/estudios" : "/campanas"}>{centro ? "Ver estudios" : "Ver campañas"}</Link></Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-foreground/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-amber/30 blur-2xl" aria-hidden />
      </section>

      <section aria-label="Resumen" className={`grid gap-4 sm:grid-cols-2 ${centro ? "" : "lg:grid-cols-3"}`}>
        {dash.isLoading && Array.from({ length: centro ? 2 : 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        {dash.isError && (
          <Card className="sm:col-span-full">
            <EmptyState error title="No pudimos cargar el resumen" text={(dash.error as Error).message}
              action={<Button variant="outline" onClick={() => dash.refetch()}>Reintentar</Button>} />
          </Card>
        )}
        {stats.map((s) => <Stat key={s.label} {...s} />)}
      </section>

      <section aria-label="Acciones rápidas" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quick.map((q) => (
          <Link key={q.label} to={q.to} className="surface lift flex min-h-24 flex-col justify-between gap-3 p-4">
            <IconChip icon={q.icon} tone={q.tone} />
            <span className="text-sm font-bold">{q.label}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="text-lg font-bold">{centro ? "Estudios por mes" : "Campañas por área"}</h2>
          <p className="text-sm text-muted-foreground">{centro ? "Últimos 6 meses" : "Total de campañas registradas"}</p>
          <div className="mt-4 h-64">
            {(centro ? estudios.isLoading : campanas.isLoading) ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                {centro ? (
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="gEst" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor={toneColor("blue")} stopOpacity={0.35} />
                        <stop offset="1" stopColor={toneColor("blue")} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} formatter={(v: number) => [fmtNum(v), "Estudios"]} />
                    <Area type="monotone" dataKey="total" stroke={toneColor("blue")} strokeWidth={2.5} fill="url(#gEst)" />
                  </AreaChart>
                ) : (
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="area" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} formatter={(v: number) => [fmtNum(v), "Campañas"]} />
                    <Bar dataKey="total" fill={toneColor("coral")} radius={[10, 10, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {veAuditoria(session) ? (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Actividad reciente</h2>
              <Link to="/actividad" className="text-sm font-semibold text-primary hover:underline">Ver todo</Link>
            </div>
            {bit.isLoading && <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
            {bit.isError && <EmptyState error title="Sin conexión" text={(bit.error as Error).message} />}
            {bit.data && bit.data.length === 0 && (
              <EmptyState title="Aún no hay movimientos" text="Cuando registre su primer paciente, aparecerá aquí."
                action={<Button asChild><Link to="/pacientes"><UserPlus /> Nuevo paciente</Link></Button>} />
            )}
            {bit.data && bit.data.length > 0 && <Timeline items={bit.data.slice(0, 6)} />}
          </Card>
        ) : (
          <Card>
            <h2 className="text-lg font-bold">Su acceso</h2>
            <p className="mt-1 text-sm font-semibold">{ROLES[session.usuario.rol].label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{ROLES[session.usuario.rol].desc}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
