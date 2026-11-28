# SISG · Qué leer, qué presentar y qué entregar (exposición: sábado 28 nov. 2026)

Todas las rutas son del repositorio `https://github.com/jaestrada40/SIGS` (desde la raíz del proyecto). Abre los `.html` con doble clic en el navegador; en las presentaciones, `N` muestra el guion, `F` la pantalla completa y `/` el buscador.

## 1. Qué entregar

| Curso | Entregable | Dónde está | Estado |
|---|---|---|---|
| **Bases de Datos II** (proyecto final, vence **28 nov. 08:00**) | 1) ER de las fuentes, 2) modelo estrella, 3) ETL, 4) consultas | Scripts: `entrega_sql/1_sisg_aplicacion.sql` y `entrega_sql/2_sisg_almacen_datos.sql` (cómo abrirlos: `entrega_sql/LEEME.md`). Detalle: `dw/sql/` (`01_`…`07_`), `dw/DISENO_ESTRELLA.md`, `dw/README.md` | Hecho. Falta confirmar con la docente en qué formato se sube (vence hoy 08:00) |
| **Administración de Proyectos Tecnológicos** (entregable 3 y exposición final) | Plan de gestión en formato IEEE, con carátula y Apéndice A (declaración de uso de IA) | **`docs/gestion/SISG_Grupo4_Plan_de_gestion_IEEE.docx`** (fuentes: `docs/gestion/01_…` a `06_…`) | Revisar los pendientes de la sección 4. Sin la declaración de IA, la nota máxima es 60% |

## 2. Presentaciones (una por curso)

| Curso | Presentación | Guion / apoyo |
|---|---|---|
| **Bases de Datos II** | `docs/PRESENTACION_SISG.html` (76 diapositivas; diapositivas 1 a 54 son datos, aplicación e integración con el Grupo 8) | `docs/GUION_PRESENTACION.md` (13 secciones, 13 a 16 min) y `docs/GUIA_PRESENTACION.md` (cómo mostrar las bases en DBeaver y levantar todo) |
| **Administración de Proyectos** | `SISG-APT` (repositorio `jaestrada40/SISG-AP`, 41 diapositivas: alcance, EDT, cronograma, riesgos, calidad, normas, Grupo 8, lecciones, IA). Respaldo anterior: `docs/PRESENTACION_APT.html` (44 diapositivas) | `GUION.html` del repositorio `SISG-AP` (el texto de cada diapositiva) |

Las dos tienen buscador, la tabla de **normas y estándares → dónde se aplica en SISG** y diapositivas de **preguntas probables**.

## 3. Qué leer, en este orden (para dominar y contestar sin dudar)

1. `docs/GUION_PRESENTACION.md` (15 min). Es el hilo completo y las preguntas probables del final.
2. `docs/EXPLICACION_BD.html` (10 min). Cómo viajan los datos de la app al almacén y al Grupo 8.
3. `docs/ESTUDIO_FLASHCARDS.html` (20 min). Repaso tipo tarjetas.
4. `docs/PRESENTACION_SISG.html` completa, con las notas (`N`). Prioriza: arquitectura, ER, estrella, ETL, consultas 1 y 8, integración con el Grupo 8 (diap. 54).
5. `docs/PRESENTACION_APT.html`, diapositivas de riesgos, calidad y normas (tabla de normas).
6. `docs/GUIA_PRESENTACION.md`, secciones 2b y 3 y 4 (usuarios de la demostración y qué mostrar).
7. `docs/gestion/04_riesgos_calidad.md` (riesgos, calidad, laboratorio A1-b) y `docs/gestion/01_acta_y_alcance.md` (enfoque híbrido).
8. `docs/PENDIENTES.md` y `docs/gestion/PENDIENTES.md` (lo que falta).

## 4. Pendiente antes del sábado (resumen; el detalle está en los dos PENDIENTES)

- **Administración de Proyectos:** carnés en la carátula; horas reales (AC): hoy CPI y EAC son un supuesto (AC = EV); laboratorio A1-b de los integrantes 2 y 3 (inventario de su equipo y un CVE vigente); anotar el resultado de la prueba de usabilidad; abrir el Word en Microsoft Word y revisar el formato.
- **Bases de Datos II / Grupo 8:** confirmar con Sharon que las 1,908 filas están bien y de quién son las 10 filas de prueba; tener una captura del tablero del Grupo 4 por si falla la red.
- **Demostración:** la app está en `https://sisg.kynova.tech` (API `https://api-sisg.kynova.tech/salud`). Usuarios de demostración en `docs/GUIA_PRESENTACION.md`, sección 2b. Configurar el MFA antes de exponer.
- **Canva:** si presentan desde Canva y no desde el HTML, agregar a mano la diapositiva del Grupo 8.

## 5. Lo que NO está en GitHub
Los tres `.docx` con credenciales de Railway (`Insert datos Grupo 1 al 4`, `Consumo datos Grupo 5 al 7`, `de grupo 8 a todos los grupos`) y la imagen de WhatsApp. Llévalos por correo o USB; no los subas.
