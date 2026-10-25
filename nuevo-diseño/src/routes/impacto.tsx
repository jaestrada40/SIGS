import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, FileJson, CalendarX2, Download, FlaskConical, HeartHandshake, Printer, Receipt, Send, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/sisg/AppShell";
import { Card, EmptyState, IconChip, ListSkeleton, PageHeader, type Tono } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { aCSV, exportarAuditado, fechaArchivo } from "@/lib/exportar";
import { api, fmtNum, fmtQ, useSession, veAuditoria, type Impacto, type PuntoMes, type ResumenReferidos } from "@/lib/api";

export const Route = createFileRoute("/impacto")({
  head: () => ({
    meta: [
      { title: "Indicadores · SISG Grupo 4" },
      { name: "description", content: "Indicadores de impacto y de negocio de su entidad." },
      { property: "og:title", content: "Indicadores · SISG Grupo 4" },
      { property: "og:description", content: "Indicadores de impacto y de negocio de su entidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Indicadores /></AppShell>,
});

const mesCorto = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1)).toLocaleDateString("es-GT", { month: "short", timeZone: "UTC" }).replace(".", "");
const AREAS: Record<string, string> = { CARDIOVASCULAR: "Cardiovascular", RESPIRATORIA: "Respiratoria", PLANIFICACION: "Planificación familiar", ONCOLOGICO_OTRO: "Oncológico y otros" };
const SEXOS: Record<string, string> = { F: "Femenino", M: "Masculino", NE: "No especificado" };

function Kpi({ icon, tone, valor, etiqueta, nota }: { icon: typeof Users; tone: Tono; valor: string; etiqueta: string; nota?: string | undefined }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <IconChip icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="font-display text-2xl font-extrabold tabular">{valor}</p>
        <p className="text-sm font-medium">{etiqueta}</p>
        {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
      </div>
    </Card>
  );
}

/** Barras horizontales con CSS (se imprimen bien y no dependen de una librería de gráficos). */
function Barras({ titulo, datos, vacio = "Aún no hay datos." }: { titulo: string; datos: { etiqueta: string; valor: number; detalle?: string | undefined }[]; vacio?: string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <Card className="break-inside-avoid">
      <h2 className="mb-3 text-lg font-bold">{titulo}</h2>
      {datos.length === 0 || datos.every((d) => d.valor === 0) ? <p className="text-sm text-muted-foreground">{vacio}</p> : (
        <ul className="space-y-2.5">
          {datos.map((d) => (
            <li key={d.etiqueta}>
              <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{d.etiqueta}</span><span className="shrink-0 tabular">{fmtNum(d.valor)}{d.detalle && <span className="text-xs text-muted-foreground"> · {d.detalle}</span>}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="presentation"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${Math.max(2, (100 * d.valor) / max)}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Meses({ titulo, datos, etiqueta, monto }: { titulo: string; datos: PuntoMes[]; etiqueta: string; monto?: boolean }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <Card className="break-inside-avoid">
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="mb-4 text-sm text-muted-foreground">Últimos 6 meses</p>
      <div className="flex h-40 items-end gap-2" role="img" aria-label={`${titulo}: ${datos.map((d) => `${mesCorto(d.mes)} ${d.valor}`).join(", ")}`}>
        {datos.map((d) => (
          <div key={d.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${mesCorto(d.mes)}: ${fmtNum(d.valor)} ${etiqueta}${monto && d.ingresos !== undefined ? ` · ${fmtQ(d.ingresos)}` : ""}`}>
            <span className="text-xs font-semibold tabular">{d.valor}</span>
            <div className="w-full rounded-t-lg bg-gradient-primary" style={{ height: `${Math.max(d.valor ? 6 : 2, (100 * d.valor) / max)}%`, opacity: d.valor ? 1 : 0.25 }} />
            <span className="text-xs text-muted-foreground">{mesCorto(d.mes)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const tasa = (r: ResumenReferidos) => (r.tasaAtencion === null ? "Aún sin cierres" : `${r.tasaAtencion}% llegó al estudio`);

function Indicadores() {
  const session = useSession()!;
  const permitido = veAuditoria(session);
  const q = useQuery({ queryKey: ["impacto"], queryFn: api.impacto, enabled: permitido });
  if (!permitido) return <Card><EmptyState title="No tiene acceso a los indicadores" text="Solo administradores y auditores pueden consultarlos." /></Card>;
  const d = q.data;
  const centro = d?.tipo === "CENTRO";

  return (
    <>
      <div className="mb-6 hidden print:block">
        <p className="text-sm text-muted-foreground">{session.entidad.nombre} · generado el {d ? new Date(d.generadoEn).toLocaleDateString("es-GT", { dateStyle: "long" }) : ""}</p>
      </div>
      <PageHeader title={d ? (centro ? "Indicadores" : "Impacto") : "Indicadores"}
        subtitle={d ? (centro ? "Cómo va su centro: estudios, ingresos y cancelaciones." : "Lo que lograron sus campañas, listo para mostrar a sus donantes.") : "Cargando…"}
        actions={d && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => exportar(d)}><Download /> Exportar CSV</Button>
            <Button onClick={() => window.print()}><Printer /> Imprimir o guardar PDF</Button>
          </div>
        )} />

      {q.isLoading && <Card><ListSkeleton /></Card>}
      {q.isError && <Card><EmptyState error title="No pudimos cargar los indicadores" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} /></Card>}

      {d && d.tipo === "CENTRO" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Banknote} tone="teal" valor={fmtQ(d.resumen.ingresos)} etiqueta="Ingresos por estudios realizados" nota={d.resumen.realizadosSinMonto ? `Solo ${d.resumen.realizadosConMonto} de ${d.resumen.realizados} realizados tienen monto` : undefined} />
            <Kpi icon={Receipt} tone="blue" valor={d.resumen.ticketPromedio === null ? "—" : fmtQ(d.resumen.ticketPromedio)} etiqueta="Cobro promedio por estudio" nota={d.resumen.ticketPromedio === null ? "Registre el monto de los estudios para calcularlo" : undefined} />
            <Kpi icon={FlaskConical} tone="teal" valor={fmtNum(d.resumen.realizados)} etiqueta="Estudios realizados" nota={`${fmtNum(d.resumen.programados)} programados`} />
            <Kpi icon={CalendarX2} tone="coral" valor={d.resumen.tasaCancelacion === null ? "—" : `${d.resumen.tasaCancelacion}%`} etiqueta="Cancelación" nota={`${fmtNum(d.resumen.cancelados)} estudios cancelados`} />
          </div>
          {d.resumen.realizadosSinMonto > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-soft p-3 text-sm print:hidden"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Estudios realizados sin monto: {d.resumen.realizadosSinMonto}. Por eso los ingresos y el cobro promedio quedan por debajo de lo real. Complete el monto desde Estudios.</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Meses titulo="Estudios por mes" datos={d.porMes} etiqueta="estudios" monto />
            <Barras titulo="Estudios por tipo" datos={d.porTipo.map((t) => ({ etiqueta: t.etiqueta, valor: t.valor, detalle: t.ingresos ? fmtQ(t.ingresos) : undefined }))} />
            <Card className="break-inside-avoid">
              <h2 className="mb-1 text-lg font-bold">Referidos recibidos</h2>
              <p className="text-3xl font-extrabold tabular">{fmtNum(d.referidos.total)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{fmtNum(d.referidos.atendidos)} atendidos · {fmtNum(d.referidos.pendientes)} en curso · {fmtNum(d.referidos.noLlegaron)} no llegaron</p>
              <p className="mt-2 text-sm font-medium">{tasa(d.referidos)}</p>
            </Card>
            <Barras titulo="Pacientes por departamento" datos={d.departamentos.map((x) => ({ etiqueta: x.departamento, valor: x.total }))} />
            <Barras titulo="Pacientes por edad" datos={d.edades.map((x) => ({ etiqueta: x.rango, valor: x.total }))} />
            <Barras titulo="Pacientes por sexo" datos={d.sexo.map((x) => ({ etiqueta: SEXOS[x.sexo] ?? x.sexo, valor: x.total }))} />
          </div>
        </div>
      )}

      {d && d.tipo === "ORG" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Users} tone="teal" valor={fmtNum(d.resumen.personas)} etiqueta="Personas atendidas" nota={`${fmtNum(d.resumen.campanas)} campañas · ${fmtNum(d.resumen.enCurso)} en curso`} />
            <Kpi icon={Wallet} tone="blue" valor={d.resumen.costoPorPersona === null ? "—" : fmtQ(d.resumen.costoPorPersona)} etiqueta="Costo por persona atendida" nota={d.resumen.costoPorPersona === null ? "Registre el costo de sus campañas para calcularlo" : `Con ${d.resumen.campanasConCosto} de ${d.resumen.campanas} campañas que tienen costo`} />
            <Kpi icon={HeartHandshake} tone="coral" valor={fmtQ(d.resumen.costo)} etiqueta="Inversión registrada" nota="Suma del costo de las campañas" />
            <Kpi icon={Send} tone="amber" valor={fmtNum(d.referidos.total)} etiqueta="Personas referidas a un centro" nota={tasa(d.referidos)} />
          </div>
          {d.resumen.campanasConCosto < d.resumen.campanas && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-soft p-3 text-sm print:hidden"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Campañas sin costo registrado: {d.resumen.campanas - d.resumen.campanasConCosto}. No entran al costo por persona ni a la inversión. Complételas desde Campañas.</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Meses titulo="Personas atendidas por mes" datos={d.porMes} etiqueta="personas" />
            <Barras titulo="Personas atendidas por área" datos={d.porArea.map((a) => ({ etiqueta: AREAS[a.etiqueta] ?? a.etiqueta, valor: a.valor, detalle: a.campanas === 1 ? "1 campaña" : `${a.campanas} campañas` }))} />
            <Barras titulo="Personas atendidas por departamento" datos={d.porDepartamento.map((x) => ({ etiqueta: x.etiqueta, valor: x.valor }))} />
            <Card className="break-inside-avoid">
              <h2 className="mb-3 text-lg font-bold">Campañas con más alcance</h2>
              {d.porCampana.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay campañas.</p> : (
                <ul className="divide-y">
                  {d.porCampana.map((c) => (
                    <li key={c.id} className="py-2.5 text-sm">
                      <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate font-semibold">{c.etiqueta}</span><span className="shrink-0 tabular">{fmtNum(c.valor)} personas</span></div>
                      <p className="text-xs text-muted-foreground">
                        {c.costo !== null && c.valor > 0 ? `${fmtQ(c.costo / c.valor)} por persona` : "Sin costo registrado"}
                        {c.referidos > 0 && ` · ${c.atendidos} de ${c.referidos} referidos llegaron al estudio`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Barras titulo="Personas registradas por edad" datos={d.edades.map((x) => ({ etiqueta: x.rango, valor: x.total }))} />
            <Barras titulo="Personas registradas por sexo" datos={d.sexo.map((x) => ({ etiqueta: SEXOS[x.sexo] ?? x.sexo, valor: x.total }))} />
          </div>
        </div>
      )}
      {d && (
        <Card className="mt-4 print:hidden">
          <h2 className="flex items-center gap-2 text-lg font-bold"><FileJson className="h-5 w-5" aria-hidden /> Intercambio de datos (FHIR, subconjunto)</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Archivos JSON en formato FHIR R4 con pacientes{centro ? ", informes de estudios realizados" : ""} y su entidad. Contienen datos personales y cada descarga queda en la auditoría. No es un servidor FHIR ni codifica estudios con LOINC o SNOMED.</p>
          <div className="flex flex-wrap gap-2">
            {(centro ? (["Patient", "DiagnosticReport", "Organization"] as const) : (["Patient", "Organization"] as const)).map((r) => (
              <Button key={r} variant="outline" size="sm" onClick={() => void descargarFhir(r)}><Download /> {r}</Button>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

async function descargarFhir(recurso: "Patient" | "DiagnosticReport" | "Organization") {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(await api.fhir(recurso), null, 2)], { type: "application/fhir+json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${recurso}_${fechaArchivo()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo descargar el archivo."); }
}

/** Resumen en CSV (sección, concepto, valor). Queda registrado en la auditoría como cualquier otra exportación. */
function exportar(d: Impacto) {
  const f: { seccion: string; concepto: string; valor: string | number }[] = [];
  const add = (seccion: string, concepto: string, valor: string | number | null) => { if (valor !== null) f.push({ seccion, concepto, valor }); };
  if (d.tipo === "CENTRO") {
    const r = d.resumen;
    add("Resumen", "Ingresos (Q)", r.ingresos); add("Resumen", "Cobro promedio (Q)", r.ticketPromedio); add("Resumen", "Estudios realizados", r.realizados);
    add("Resumen", "Estudios programados", r.programados); add("Resumen", "Estudios cancelados", r.cancelados); add("Resumen", "Cancelación (%)", r.tasaCancelacion);
    add("Resumen", "Realizados sin monto", r.realizadosSinMonto);
    d.porMes.forEach((m) => { add("Estudios por mes", m.mes, m.valor); add("Ingresos por mes (Q)", m.mes, m.ingresos ?? 0); });
    d.porTipo.forEach((t) => { add("Estudios por tipo", t.etiqueta, t.valor); add("Ingresos por tipo (Q)", t.etiqueta, t.ingresos ?? 0); });
  } else {
    const r = d.resumen;
    add("Resumen", "Personas atendidas", r.personas); add("Resumen", "Campañas", r.campanas); add("Resumen", "Campañas en curso", r.enCurso);
    add("Resumen", "Inversión registrada (Q)", r.costo); add("Resumen", "Costo por persona (Q)", r.costoPorPersona);
    d.porMes.forEach((m) => add("Personas por mes", m.mes, m.valor));
    d.porArea.forEach((a) => add("Personas por área", AREAS[a.etiqueta] ?? a.etiqueta, a.valor));
    d.porDepartamento.forEach((x) => add("Personas por departamento", x.etiqueta, x.valor));
  }
  add("Referidos", "Total", d.referidos.total); add("Referidos", "Atendidos", d.referidos.atendidos); add("Referidos", "Atención (%)", d.referidos.tasaAtencion);
  d.sexo.forEach((x) => add("Pacientes por sexo", SEXOS[x.sexo] ?? x.sexo, x.total)); d.edades.forEach((x) => add("Pacientes por edad", x.rango, x.total));
  void exportarAuditado("impacto", f.length, aCSV(f, [{ titulo: "seccion", valor: (x) => x.seccion }, { titulo: "concepto", valor: (x) => x.concepto }, { titulo: "valor", valor: (x) => x.valor }]), `indicadores_${fechaArchivo()}.csv`);
}
