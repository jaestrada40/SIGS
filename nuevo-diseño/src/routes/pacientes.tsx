import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Pencil, Phone, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sisg/AppShell";
import { ImportDialog } from "@/components/sisg/ImportDialog";
import { OcrDpi, type DpiDatos } from "@/components/sisg/OcrDpiDialog";
import { Avatar, Card, EmptyState, Field, FilterChip, inputCls, ListSkeleton, PageHeader, Tag } from "@/components/sisg/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError, fmtFecha, fmtNum, puedeEscribir, useSession, type Paciente, type Sexo } from "@/lib/api";
import type { Columna } from "@/lib/csv";
import { aCSV, exportarAuditado, fechaArchivo } from "@/lib/exportar";

export const Route = createFileRoute("/pacientes")({
  head: () => ({
    meta: [
      { title: "Pacientes · SISG Grupo 4" },
      { name: "description", content: "Registro y gestión de pacientes de su entidad." },
      { property: "og:title", content: "Pacientes · SISG Grupo 4" },
      { property: "og:description", content: "Registro y gestión de pacientes de su entidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Pacientes /></AppShell>,
});

const SEXOS: Record<Sexo, string> = { F: "Femenino", M: "Masculino", NE: "No especificado" };
const COLUMNAS: Columna[] = [
  { clave: "nombreCompleto", requerida: true },
  { clave: "sexo", requerida: true, opciones: ["F", "M", "NE"] },
  { clave: "dpi" }, { clave: "fechaNacimiento", tipo: "fecha" }, { clave: "departamento" }, { clave: "municipio" },
  { clave: "telefono" }, { clave: "contactoEmergencia" }, { clave: "estado" },
];

function Pacientes() {
  const qc = useQueryClient();
  const escribe = puedeEscribir(useSession());
  const q = useQuery({ queryKey: ["pacientes"], queryFn: api.pacientes });
  const [busca, setBusca] = useState("");
  const [sexo, setSexo] = useState<Sexo | "">("");
  const [estado, setEstado] = useState("");
  const [depto, setDepto] = useState("");
  const [sel, setSel] = useState<Paciente | "nuevo" | null>(null);
  const [importar, setImportar] = useState(false);

  const lista = q.data ?? [];
  const deptos = useMemo(() => [...new Set(lista.map((p) => p.departamento).filter(Boolean) as string[])].sort(new Intl.Collator("es").compare), [lista]);
  const estados = useMemo(() => [...new Set(lista.map((p) => p.estado).filter(Boolean) as string[])].sort(), [lista]);
  const filtrados = lista.filter((p) => {
    const t = busca.trim().toLowerCase();
    return (!t || p.nombreCompleto.toLowerCase().includes(t) || (p.dpi ?? "").includes(t))
      && (!sexo || p.sexo === sexo) && (!estado || p.estado === estado) && (!depto || p.departamento === depto);
  });

  return (
    <>
      <PageHeader title="Pacientes" subtitle={q.data ? `${fmtNum(lista.length)} pacientes registrados` : "Busque, registre y actualice pacientes."}
        actions={<>
          <Button variant="outline" disabled={!filtrados.length} onClick={() => exportarAuditado("paciente", filtrados.length, aCSV(filtrados, COLUMNAS.map((c) => ({ titulo: c.clave, valor: (p: Paciente) => p[c.clave as keyof Paciente] }))), `pacientes_${fechaArchivo()}.csv`)}><Download /> Exportar CSV</Button>
          {escribe && <Button variant="outline" onClick={() => setImportar(true)}><FileSpreadsheet /> Importar CSV</Button>}
          {escribe && <Button onClick={() => setSel("nuevo")}><UserPlus /> Nuevo paciente</Button>}
        </>} />

      <Card className="mb-4 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar por nombre o DPI" placeholder="Buscar por nombre o DPI…" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Sexo:</span>
          <FilterChip active={!sexo} onClick={() => setSexo("")}>Todos</FilterChip>
          {(Object.keys(SEXOS) as Sexo[]).map((s) => <FilterChip key={s} active={sexo === s} onClick={() => setSexo(sexo === s ? "" : s)}>{SEXOS[s]}</FilterChip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estados.length > 0 && <>
            <span className="text-sm font-semibold text-muted-foreground">Estado:</span>
            {estados.map((s) => <FilterChip key={s} active={estado === s} onClick={() => setEstado(estado === s ? "" : s)}>{titulo(s)}</FilterChip>)}
          </>}
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <label htmlFor="f-depto" className="text-sm font-semibold text-muted-foreground">Departamento</label>
            <select id="f-depto" value={depto} onChange={(e) => setDepto(e.target.value)} className={`${inputCls} h-9 min-w-0 flex-1 sm:w-48 sm:flex-none`}>
              <option value="">Todos</option>
              {deptos.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {q.isLoading && <div className="p-5"><ListSkeleton /></div>}
        {q.isError && <EmptyState error title="No pudimos cargar los pacientes" text={(q.error as Error).message} action={<Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>} />}
        {q.data && lista.length === 0 && <EmptyState title="Aún no hay pacientes" text="Registre el primero o importe varios desde un archivo CSV." action={<Button onClick={() => setSel("nuevo")}><UserPlus /> Nuevo paciente</Button>} />}
        {q.data && lista.length > 0 && filtrados.length === 0 && <EmptyState title="Sin resultados" text="Ningún paciente coincide con la búsqueda o los filtros." action={<Button variant="outline" onClick={() => { setBusca(""); setSexo(""); setEstado(""); setDepto(""); }}><X /> Limpiar filtros</Button>} />}
        {filtrados.length > 0 && (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Sexo</th><th className="px-5 py-3">Nacimiento</th><th className="px-5 py-3">Ubicación</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3"><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/50" onClick={() => setSel(p)}>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={p.nombreCompleto} /><div><p className="font-semibold">{p.nombreCompleto}</p><p className="text-xs text-muted-foreground tabular">{p.dpi ? `DPI ${p.dpi}` : "Sin DPI"}</p></div></div></td>
                    <td className="px-5 py-4">{SEXOS[p.sexo]}</td>
                    <td className="px-5 py-4 tabular">{fmtFecha(p.fechaNacimiento)}</td>
                    <td className="px-5 py-4">{[p.municipio, p.departamento].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-5 py-4">{p.estado ? <Tag tone={p.estado === "ACTIVO" ? "teal" : "amber"}>{titulo(p.estado)}</Tag> : "—"}</td>
                    <td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSel(p); }} aria-label={`Ver o editar a ${p.nombreCompleto}`}><Pencil /> Ver</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y md:hidden">
              {filtrados.map((p) => (
                <li key={p.id}>
                  <button className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50" onClick={() => setSel(p)}>
                    <Avatar name={p.nombreCompleto} />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.nombreCompleto}</p><p className="text-xs text-muted-foreground">{SEXOS[p.sexo]} · {p.departamento ?? "Sin departamento"}</p></div>
                    {p.estado && <Tag tone={p.estado === "ACTIVO" ? "teal" : "amber"}>{titulo(p.estado)}</Tag>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <PacienteSheet sel={sel} onClose={() => setSel(null)} />
      <ImportDialog open={importar} onOpenChange={setImportar} titulo="Importar pacientes" columnas={COLUMNAS}
        ejemplo={["María López", "F", "1234567890101", "15/04/1990", "Guatemala", "Mixco", "5555-1234", "Juan López 5555-4321", "ACTIVO"]}
        nombrePlantilla="plantilla_pacientes.csv" onImport={(f) => api.importarPacientes(f)}
        onDone={(n) => { toast.success(`${fmtNum(n)} pacientes importados`); void qc.invalidateQueries(); }} />
    </>
  );
}

export function titulo(s: string) {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function PacienteSheet({ sel, onClose }: { sel: Paciente | "nuevo" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const escribe = puedeEscribir(useSession());
  const nuevo = sel === "nuevo";
  const p = sel && sel !== "nuevo" ? sel : null;
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modo = nuevo || editando;

  function completarDpi(datos: DpiDatos) {
    const campos = ["dpi", "nombreCompleto", "fechaNacimiento", "departamento", "municipio"] as const;
    for (const campo of campos) {
      const valor = datos[campo];
      const input = document.getElementById(campo) as HTMLInputElement | HTMLSelectElement | null;
      if (input && valor) { input.value = valor; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); }
    }
    if (datos.sexo) {
      const sexo = document.getElementById("sexo") as HTMLSelectElement | null;
      if (sexo) { sexo.value = datos.sexo; sexo.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  }

  const m = useMutation({
    mutationFn: (b: Omit<Paciente, "id">) => (p ? api.editarPaciente(p.id, b) : api.crearPaciente(b)),
    onSuccess: () => {
      toast.success(p ? "Paciente actualizado" : "Paciente registrado");
      void qc.invalidateQueries();
      setEditando(false); onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "No se pudo guardar."),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const b: Omit<Paciente, "id"> = { nombreCompleto: g("nombreCompleto"), sexo: (g("sexo") || "NE") as Sexo };
    for (const k of ["dpi", "fechaNacimiento", "departamento", "municipio", "telefono", "contactoEmergencia", "estado"] as const) {
      const v = g(k); if (v) b[k] = v;
    }
    if (!b.nombreCompleto) { setError("Escriba el nombre completo."); return; }
    if (b.dpi && !/^\d{13}$/.test(b.dpi)) { setError("El DPI debe tener exactamente 13 dígitos."); return; }
    if (b.telefono && !TELEFONO_GT.test(limpiarTelefono(b.telefono))) { setError("El teléfono debe tener 8 dígitos, por ejemplo 5512 3456 (se acepta +502)."); return; }
    if (b.municipio && !b.departamento) { setError("Elija primero el departamento."); return; }
    m.mutate(b);
  }

  return (
    <Sheet open={sel !== null} onOpenChange={(o) => { if (!o) { setEditando(false); setError(null); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          {p && <div className="mb-2 flex items-center gap-3"><Avatar name={p.nombreCompleto} /><Tag tone="teal">{SEXOS[p.sexo]}</Tag></div>}
          <SheetTitle className="font-display text-2xl">{nuevo ? "Nuevo paciente" : p?.nombreCompleto}</SheetTitle>
          <SheetDescription>{nuevo ? "Los campos con * son obligatorios." : editando ? "Actualice los datos y guarde." : "Datos del paciente."}</SheetDescription>
        </SheetHeader>

        {p && !modo && (
          <div className="mt-6 space-y-4">
            <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-muted/60 p-4 text-sm">
              {([
                ["DPI", p.dpi], ["Nacimiento", fmtFecha(p.fechaNacimiento)], ["Departamento", p.departamento], ["Municipio", p.municipio],
                ["Teléfono", p.telefono], ["Contacto de emergencia", p.contactoEmergencia], ["Estado", p.estado ? titulo(p.estado) : null],
              ] as const).map(([k, v]) => (
                <div key={k}><dt className="text-xs font-semibold text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v || "—"}</dd></div>
              ))}
            </dl>
            <div className="flex gap-2">
              {escribe && <Button onClick={() => setEditando(true)}><Pencil /> Editar</Button>}
              {p.telefono && <Button variant="outline" asChild><a href={`tel:${p.telefono}`}><Phone /> Llamar</a></Button>}
            </div>
          </div>
        )}

        {modo && (
          <form onSubmit={submit} className="mt-6 space-y-4" key={p?.id ?? "nuevo"}>
            <Field id="nombreCompleto" label="Nombre completo" required><input id="nombreCompleto" name="nombreCompleto" required defaultValue={p?.nombreCompleto} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="sexo" label="Sexo" required>
                <select id="sexo" name="sexo" defaultValue={p?.sexo ?? "F"} className={inputCls}>
                  {(Object.keys(SEXOS) as Sexo[]).map((s) => <option key={s} value={s}>{SEXOS[s]}</option>)}
                </select>
              </Field>
              <Field id="fechaNacimiento" label="Fecha de nacimiento"><input id="fechaNacimiento" name="fechaNacimiento" type="date" defaultValue={p?.fechaNacimiento ?? ""} className={inputCls} /></Field>
            </div>
            <Field id="dpi" label="DPI"><OcrDpi onFound={completarDpi} /><input id="dpi" name="dpi" inputMode="numeric" maxLength={13} defaultValue={p?.dpi ?? ""} placeholder="13 dígitos"
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""); }} className={inputCls} /></Field>
            <Ubicacion depto={p?.departamento ?? ""} municipio={p?.municipio ?? ""} />
            <div className="grid grid-cols-2 gap-3">
              <Field id="telefono" label="Teléfono"><input id="telefono" name="telefono" type="tel" inputMode="tel" maxLength={18} defaultValue={p?.telefono ?? ""} placeholder="5512 3456"
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d\s+-]/g, ""); }} className={inputCls} /></Field>
              <Field id="estado" label="Estado">
                <select id="estado" name="estado" defaultValue={p?.estado ?? "ACTIVO"} className={inputCls}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select>
              </Field>
            </div>
            <Field id="contactoEmergencia" label="Contacto de emergencia"><input id="contactoEmergencia" name="contactoEmergencia" defaultValue={p?.contactoEmergencia ?? ""} placeholder="Nombre y teléfono" className={inputCls} /></Field>
            {error && <p role="alert" className="rounded-xl bg-coral-soft p-3 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => (editando ? setEditando(false) : onClose())}>Cancelar</Button>
              <Button type="submit" disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Guardar</Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

const TELEFONO_GT = /^[2-7]\d{7}$/;   // misma regla que el servidor: 8 dígitos que empiezan en 2-7
const limpiarTelefono = (v: string) => v.replace(/^\+?502/, "").replace(/[\s-]/g, "");

/** Departamento y municipio en cascada: el municipio solo ofrece los del departamento elegido, ambos en orden alfabético. */
function Ubicacion({ depto, municipio }: { depto: string; municipio: string }) {
  const geo = useQuery({ queryKey: ["geografia"], queryFn: api.geografia, staleTime: Infinity });
  const [dep, setDep] = useState(depto);
  const [mun, setMun] = useState(municipio);
  const g = geo.data ?? {};
  const deptos = Object.keys(g);                 // el servidor ya los entrega ordenados
  const munis = g[dep] ?? [];
  // Un valor guardado antes del catálogo se conserva como opción para no perderlo; al guardar, el servidor decide si es válido.
  const deptosOpc = depto && !g[depto] && geo.data ? [depto, ...deptos] : deptos;
  const munisOpc = mun && !munis.includes(mun) ? [mun, ...munis] : munis;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id="departamento" label="Departamento">
        <select id="departamento" name="departamento" value={dep} onChange={(e) => { setDep(e.target.value); setMun(""); }} className={inputCls}>
          <option value="">{geo.isLoading ? "Cargando…" : "Seleccione…"}</option>
          {deptosOpc.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>
      <Field id="municipio" label="Municipio">
        <select id="municipio" name="municipio" value={mun} onChange={(e) => setMun(e.target.value)} disabled={!dep} className={inputCls}>
          <option value="">{dep ? "Seleccione…" : "Elija primero el departamento"}</option>
          {munisOpc.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
    </div>
  );
}
