# Pendientes antes de entregar (lo que solo el grupo puede completar)

Corte: 24 de octubre de 2026. Marca cada casilla cuando esté hecho.

## 1. Decisiones que bloquean
- [x] **MySQL es definitivo** (decisión del grupo, 24 oct.). Ya no se pregunta a la Inga. Alegre; el riesgo R1 pasa a cerrado y la tabla de equivalencias de `dw/README.md` queda solo como referencia.
- [ ] **Asignar roles** (líder, responsable de datos, responsable de aplicación y calidad) en el acta, sección 9, y en el Word.
- [ ] **Confirmar con el grupo** las horas por paquete, los % de avance, los valores PERT y las valoraciones de riesgo e interesados. Son estimaciones iniciales.

## 2. Datos que faltan
- [ ] **Horas reales trabajadas (AC)** por paquete, para calcular CPI y EAC. Sin esto el reporte de estado queda incompleto.
- [ ] **Carnés** de los tres integrantes en la carátula.
- [ ] **Apéndice A (declaración de IA):** completar el *nivel de modificación* con el porcentaje o descripción real de lo que el grupo revisó y reescribió. Es el campo que marca ⚠. **Sin la declaración la nota máxima es 60%.** Preguntar si Bases de Datos II exige la misma declaración.
- [ ] **Medir usabilidad y desempeño** (tabla de especificación de calidad): una prueba con 3 a 5 personas y el tiempo de las consultas 1 y 8.

## 2b. Lo que dejó la clase del 24 de octubre (riesgos) y los cambios de ese día
- [ ] **Laboratorio A1-b (individual):** cada integrante completa su fila de la TABLA VI de `04_riesgos_calidad.md` (sistema, compilación, estado, decisión) y la **Parte B** (una vulnerabilidad vigente de su versión exacta, consultada en el NVD, con CVE, CVSS, explotación conocida, versión corregida y aviso del fabricante). Hoy solo está la fila del integrante 1, con su Parte B (CVE-2026-65395, consultada el 24 de oct.; **confírmenla en la ficha del NVD antes de entregar**). Faltan los integrantes 2 y 3. Cada quien escribe su mensaje de 3 líneas al gerente.
- [ ] **Validar con el grupo** las valoraciones y los «porque» de los riesgos nuevos (R12 a R14) y las 12 h del paquete 3.4 (seguridad y usuarios), que se agregaron al plan.
- [ ] **Verificar el catálogo de municipios** (`backend/src/common/geografia.ts`): tiene 339 y el oficial son 340; se escribió de memoria. El almacén usa el mismo catálogo (`dw/sql/01b_catalogos.sql`).
- [x] **Puente de la aplicación al almacén repetido el 24 de oct.** con la base de pruebas (`./run_app.sh sisg_test`): ETL OK y reconciliación con diferencia 0 en filas y montos. El script ahora escribe los CSV con Python porque la redirección del shell fallaba en `dw/data/`. Para volver a los datos sintéticos de la demostración, corre `./run.sh`.
- [ ] **Antes de publicar la aplicación:** HTTPS, sesión en cookie `HttpOnly`, migraciones de base de datos, contraseña propia para MySQL y respaldos (riesgo R12).
- [ ] Completar los datos de la entidad **Usuario administrador**: el primer usuario de cada entidad se llama «Administrador»; conviene cambiarle el nombre en Usuarios.

## 3. Cosas que no pude leer o verificar
- [ ] Lineamientos de los **entregables 2 y 3** de Administración de Proyectos (las tareas de Classroom no muestran descripción; preguntar al docente; el sílabo los ubica en las semanas 8 (entregable 2) y 15 (entregable 3 y final)).
- [ ] La **rúbrica de coevaluación** y el examen resuelto del parcial I.
- [ ] Las presentaciones de **metodologías ágiles** y la lista de lecturas.
- [ ] La **rúbrica** de la tarea del 30 de octubre (diseño estrella) y del proyecto final de Bases de Datos II (la tarea tampoco muestra criterios).
- [ ] **Abrir el Word en Microsoft Word** y revisar que las columnas, tablas y figuras fluyan bien (solo pasó el validador de esquema, no lo vi renderizado).

## 4. Fechas
| Fecha | Qué |
|---|---|
| 30 oct. | Presentar el diseño estrella (`dw/DISENO_ESTRELLA.md`) |
| 5 nov. | ETL con datos reales de la aplicación |
| 20–21 nov. | Exposición final (semana 19) e informe de cierre |
| **28 nov., 8:00** | **Entrega del proyecto final de Bases de Datos II** (la cadena tiene 2 días de holgura) |

## 5. Lista de verificación de cada entrega
- [ ] Carátula, formato IEEE (Letter, Times New Roman, dos columnas, citas numeradas).
- [ ] Apéndice de declaración de uso de IA completo.
- [ ] Números revisados (el Word y los `.md` salen de `generador/plan.py`; si cambias horas o fechas, vuelve a generar).
- [ ] `dw/run.sh` corre desde cero y `dw/sql/07_reconciliacion.sql` da diferencia 0.
- [ ] `npm run test:e2e` en `backend/` pasa al 100%.

## Dónde está cada cosa
| Qué | Dónde |
|---|---|
| Acta y alcance | `docs/gestion/01_acta_y_alcance.md` |
| EDT, cronograma, ruta crítica, PERT, valor ganado | `docs/gestion/02_edt_cronograma_costos.md` |
| Interesados, comunicaciones, reporte de estado | `docs/gestion/03_interesados_comunicaciones.md` |
| Riesgos y calidad | `docs/gestion/04_riesgos_calidad.md` |
| Declaración de IA | `docs/gestion/05_apendice_declaracion_ia.md` |
| **Word IEEE para entregar** | `docs/gestion/SISG_Grupo4_Plan_de_gestion_IEEE.docx` |
| Scripts que recalculan todo | `docs/gestion/generador/` |
| Almacén de datos, ETL, consultas | `dw/` (`README.md` y `DISENO_ESTRELLA.md`) |
| Aplicación | `backend/` (carga: `./run.sh` en `dw/`; app: `npm run start:dev` en `backend/`) |
