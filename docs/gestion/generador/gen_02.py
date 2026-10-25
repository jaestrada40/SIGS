import json
import os
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'   # carpeta docs/gestion
RES = json.load(open('reserva.json'))['res_total']
P = json.load(open('plan.json')); E = P['evm']; C = P['cadena_bd2']
fm = lambda d: {"01":"ene","02":"feb","03":"mar","04":"abr","05":"may","06":"jun","07":"jul","08":"ago","09":"sep","10":"oct","11":"nov","12":"dic"}[d[5:7]] and f"{int(d[8:])} {['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][int(d[5:7])]}"
sec = {"1":"Gestión del proyecto","2":"Datos (Bases de Datos II)","3":"Aplicación web","4":"Calidad y pruebas","5":"Cierre"}

edt_rows = "\n".join(f"| {c} | {n} | {h} | {fm(i)} – {fm(f)} | {a}% | {r} |" for c, n, h, i, f, a, r in P['edt'])
red_rows = "\n".join(f"| {r['id']} | {r['nombre']} | {r['dur']} | {r['pred']} | {r['ES']} | {r['EF']} | {r['LS']} | {r['LF']} | {r['holgura']} | {fm(r['inicio'])} – {fm(r['fin'])} |" for r in P['red'])
pert_rows = "\n".join(f"| {r['id']} | {r['nombre']} | {r['O']} | {r['M']} | {r['P']} | {r['PERT']} | {r['sigma']} |" for r in P['red'] if r['id'] in "BCDEKL")
gantt = ["gantt", "  title SISG Grupo 4 – actividades restantes (calculadas con el método de precedencias)", "  dateFormat YYYY-MM-DD", "  axisFormat %d %b",
         "  section Bases de Datos II (cadena con menor holgura)"]
for r in P['red']:
    if r['id'] in "BCDEKL": gantt.append(f"  {r['nombre'].replace(':',' ')} :{'crit, ' if r['id'] in 'KL' else ''}{r['id'].lower()}, {r['inicio']}, {r['dur']}d")
gantt.append("  section Administración de Proyectos")
for r in P['red']:
    if r['id'] in "AFGHIJ": gantt.append(f"  {r['nombre'].replace(':',' ')} :{'crit, ' if r['id']=='J' else ''}{r['id'].lower()}, {r['inicio']}, {r['dur']}d")
gantt = "\n".join(gantt)
nodes = "\n".join(f"  {r['id']}[\"{r['id']}: {r['nombre']}<br/>{r['dur']} d · holgura {r['holgura']}\"]" for r in P['red'])
edges = "\n".join(f"  {p.split('(')[0]} --> {r['id']}" for r in P['red'] for p in r['pred'].split(',') if p != '—')

md = f"""# SISG – Módulo Grupo 4: EDT, cronograma y costos

**Versión:** 0.2 (borrador) · **Corte:** 24 de octubre de 2026 · Se genera con `plan.py`, no se transcribe a mano.
> **Declaración de uso de IA:** ver el apéndice en `05_apendice_declaracion_ia.md`.

## 1. EDT (Estructura de Desglose del Trabajo)
Regla del 100%: los paquetes de trabajo (nivel 2) suman todo el alcance del nivel 1. Las horas son **estimaciones iniciales** del
esfuerzo; el grupo debe reemplazarlas por sus horas reales para que el valor ganado sea válido.

```mermaid
flowchart LR
  P[0 SISG – Módulo Grupo 4] --> G[1 Gestión del proyecto]
  P --> D[2 Datos – Bases de Datos II]
  P --> A[3 Aplicación web]
  P --> Q[4 Calidad y pruebas]
  P --> X[5 Cierre]
  G --> G1[1.1 Acta y alcance] & G2[1.2 EDT, cronograma y costos] & G3[1.3 Interesados y comunicaciones] & G4[1.4 Riesgos y calidad] & G5[1.5 Reportes de estado]
  D --> D1[2.1 ER de las fuentes] & D2[2.2 Modelo estrella] & D3[2.3 ETL] & D4[2.4 Consultas] & D5[2.5 Documento técnico]
  A --> A1[3.1 Backend y autenticación] & A2[3.2 Interfaz y rediseño] & A3[3.3 Carga masiva y bitácora] & A4[3.4 Seguridad y usuarios]
  Q --> Q1[4.1 Pruebas e2e] & Q2[4.2 Reconciliación fuente–DW] & Q3[4.3 Revisión por pares]
  X --> X1[5.1 Informe de cierre] & X2[5.2 Exposición final] & X3[5.3 Entrega final BD II]
```

**TABLA I: DICCIONARIO DE PAQUETES DE TRABAJO**

| Código | Paquete | Horas | Fechas | Avance | Responsable |
|---|---|---:|---|---:|---|
{edt_rows}

Responsables propuestos por rol (Líder, Datos, Calidad, Todos); el grupo debe asignar personas.

## 2. Secuenciación: método de diagramación por precedencia (PDM)
Actividades **restantes** a partir del lunes 26 de octubre de 2026 (días calendario). Se agregan dos restricciones reales:
la exposición solo puede darse el 20–21 de noviembre (semana 19) y la entrega de Bases de Datos II vence el **28 de noviembre a las 8:00**.
`K(−2)` significa que la revisión por pares empieza 2 días antes de terminar el documento técnico (solape).

```mermaid
flowchart LR
{nodes}
{edges}
```

**TABLA II: ACTIVIDADES, PREDECESORAS Y HOLGURA (ES/EF = inicio/fin temprano; LS/LF = inicio/fin tardío, en días desde el 26 oct.)**

| ID | Actividad | Duración (d) | Predecesoras | ES | EF | LS | LF | Holgura | Fechas |
|---|---|---:|---|---:|---:|---:|---:|---:|---|
{red_rows}

## 3. Ruta crítica (CPM)
- **J (exposición final)** tiene holgura 0 porque su fecha está fija por el calendario del curso.
- La cadena de **Bases de Datos II B → C → D → E → K → L** termina el **{fm(P['fin_calculado'])}** (fin de día), con **{C['holgura_dias']} días de holgura** frente al límite del 28 de nov. a las 8:00.
  Es la ruta con menor holgura de la entrega de Bases de Datos II; un atraso de más de 2 días en cualquiera de sus actividades la incumple.

### Estimación de tres valores (PERT)
Esperado = (O + 4M + P) / 6 · desviación = (P − O) / 6. Valores O/M/P: **estimaciones del autor del borrador; el grupo debe validarlas**.

**TABLA III: ESTIMACIÓN PERT DE LA CADENA DE BASES DE DATOS II**

| ID | Actividad | O | M | P | Esperado (d) | σ |
|---|---|---:|---:|---:|---:|---:|
{pert_rows}

Duración esperada de la cadena: **{C['esperado_dias']} días** (se restan 2 por el solape) con σ = {C['sigma']} días. Días disponibles hasta el límite: **{C['limite_dias']}**.
z = ({C['limite_dias']} − {C['esperado_dias']}) / {C['sigma']} = {C['z']} → **probabilidad de cumplir ≈ {C['prob_cumplir_pct']}%**.
Para subirla: empezar el ETL con datos reales ya (actividad C), no esperar la presentación de la tarea del 30 de octubre (B), y mantener el solape de K con E.

## 4. Cronograma (Gantt)
```mermaid
{gantt}
```
El Gantt anterior solo cubre las actividades restantes; el trabajo ya hecho está en la TABLA I (avance 100%).

## 5. Costos y valor ganado
SISG no tiene presupuesto monetario. Se usa **horas-persona** como unidad de costo (el mismo método sirve con quetzales).

- **BAC** (presupuesto total) = **{E['BAC']} h** (suma de la TABLA I).
- **Reserva de contingencia** ({E['contingencia_pct']}% del BAC, para riesgos identificados) = **{E['contingencia']} h**. Se subió del 10% sugerido en clase porque las respuestas a los riesgos suman {RES} h (ver `04_riesgos_calidad.md`). **Reserva de gestión** (5%, imprevistos) = **{E['gestion_5pct']} h**. Presupuesto con reservas = {round(E['BAC'] + E['contingencia'] + E['gestion_5pct'], 1)} h.
- Fórmulas: CPI = EV/AC · SPI = EV/PV · EAC = BAC/CPI (si el desempeño de costo continúa) · Avance = EV/BAC.

**TABLA IV: INDICADORES DE VALOR GANADO AL 24 DE OCTUBRE DE 2026**

| Indicador | Valor | Cómo se obtuvo |
|---|---:|---|
| BAC | {E['BAC']} h | Suma de las horas planificadas |
| PV (valor planificado) | {E['PV']} h | Horas de cada paquete × fracción del plazo transcurrido |
| EV (valor ganado) | {E['EV']} h | Horas de cada paquete × % de avance |
| SPI = EV/PV | **{E['SPI']}** | Mayor que 1: adelantados respecto del plan |
| Avance = EV/BAC | **{E['avance']}%** | |
| AC (costo real) | *pendiente* | **El grupo debe registrar las horas realmente trabajadas** |
| CPI = EV/AC | *pendiente* | Requiere AC |
| EAC = BAC/CPI | *pendiente* | Requiere CPI |

> El SPI > 1 depende de los % de avance y de las horas, que son estimaciones del borrador. No debe reportarse como resultado hasta validar ambos con el grupo.

## 6. Enfoque híbrido: Fase 0 y sprints
Marco **predictivo** (Fase 0 y hitos fin-a-inicio en la ruta crítica) con ejecución **ágil** por sprints, cada uno con su *Sprint Goal*, su incremento y su *Definition of Done* (Scrum Guide 2020 y sesión del 24 de octubre).
La regla del roadmap de la sesión se adapta así: **el modelo de datos verificado va antes que las consultas, y cada sprint construye sobre lo que el anterior dejó verificado**.
Entre sprints hay un hito: si uno se atrasa, se mueve la fecha de los primeros pasos del siguiente (no se solapan sin verificación). El *Product Backlog* son las historias de usuario de `01_acta_y_alcance.md` (Parte B).

**TABLA V: ETAPAS, SPRINT GOAL Y DEFINITION OF DONE**

| Etapa | Sprint Goal / objetivo | Paquetes EDT | Definition of Done (resultado verificable) | Estado al 24 oct. |
|---|---|---|---|---|
| Fase 0 · Preparación (predictiva) | Requisitos, alcance y cronograma de hitos aprobados | 1.1 a 1.4, 2.1 | Acta, alcance y EDT validados por el grupo; ER de las fuentes entregado | ER entregado; documentos en borrador por validar |
| Sprint 1 · Fuente operativa | Tener una aplicación fuente segura y con datos | 3.1 a 3.4, 4.1 | 100% de pruebas e2e en verde (49 de 49); MFA, roles y auditoría activos | **Hecho** |
| Sprint 2 · Modelo estrella | Diseño del almacén aprobado y presentado | 2.2 | Presentado el 30 de octubre, sin datos personales en el modelo | En curso |
| Sprint 3 · ETL con datos reales | Cargar los datos de la aplicación al almacén | 2.3, 4.2 | Reconciliación fuente–DW con diferencia 0 con datos de la aplicación (5 de noviembre) | En curso |
| Sprint 4 · Consultas y documento técnico | Responder las preguntas de análisis | 2.4, 2.5 | 8 consultas sin error con `EXPLAIN`; documento técnico revisado por pares | Por iniciar |
| Sprint 5 · Cierre | Entregar y exponer | 4.3, 5.1 a 5.3 | Lista de verificación completa; exposición el 20–21 de noviembre; entrega el 28 de noviembre antes de las 8:00 | Por iniciar |

Al cierre de cada sprint hay una revisión (*Review*) del incremento y una retrospectiva breve que se anota en el reporte de estado semanal.
"""
open(DIR + '02_edt_cronograma_costos.md', 'w').write(md)
print(len(md))
