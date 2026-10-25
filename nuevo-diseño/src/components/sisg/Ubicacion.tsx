import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Field, inputCls } from "@/components/sisg/ui";
import { api } from "@/lib/api";

export function Ubicacion({ depto, municipio, forzar }: { depto: string; municipio: string; forzar?: { depto: string; municipio: string; n: number } | null }) {
  const geo = useQuery({ queryKey: ["geografia"], queryFn: api.geografia, staleTime: Infinity });
  const [dep, setDep] = useState(depto);
  const [mun, setMun] = useState(municipio);
  // Valores que llegan desde fuera (por ejemplo, leídos de un DPI): cada n nuevo reemplaza la selección.
  useEffect(() => { if (forzar) { setDep(forzar.depto); setMun(forzar.municipio); } }, [forzar]);
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
