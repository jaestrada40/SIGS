import json
import os
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'   # carpeta docs/gestion
P = json.load(open('plan.json')); E = P['evm']; C = P['cadena_bd2']
OUT = DIR

# ---------------- 03: interesados y comunicaciones ----------------
ST = [  # id, rol, tipo, expectativa, poder, interés, estrategia
 ("Docentes (Ing. Barrios e Inga. Alegre)","Interno","Entregables completos, correctos y a tiempo; declaración de IA y formato IEEE",5,5,"Reportes de estado y entregas por Classroom; consultar dudas de alcance antes de decidir"),
 ("Equipo del Grupo 4","Interno","Aprobar ambos cursos con la carga repartida",4,5,"Reunión semanal de 15 min y registro de horas"),
 ("Gestor de plataforma (Grupo 8)","Externo","Cumplimiento de seguridad, normas y control de acceso",5,4,"Acordar formatos de datos y requisitos de seguridad; reunión quincenal"),
 ("Ministerio de Salud, INE y Estado (Grupo 2)","Externo","Datos confiables y comparables para políticas públicas",5,4,"Mostrar el modelo estrella y la reconciliación fuente–DW"),
 ("Hospitales y red pública (Grupos 1 y 2)","Externo","Continuidad de atención con datos de estudios",4,4,"Entregar esquema y plantillas de carga"),
 ("Seguro social (Grupo 3)","Externo","Resultados de diagnóstico de sus afiliados",3,4,"Informar avances y el diseño final"),
 ("Centros de diagnóstico (usuarios del Grupo 4)","Externo","Registrar estudios rápido y sin errores",3,5,"Plantilla CSV, mensajes de error por fila y capacitación breve"),
 ("Organismos no lucrativos (usuarios del Grupo 4)","Externo","Medir personas atendidas y costo por persona en campañas",3,5,"Informar avances; mostrar el panel y la consulta de campañas"),
 ("Aseguradoras (Grupo 5)","Externo","Datos agregados para análisis",3,3,"Monitorear; compartir solo consultas agregadas"),
 ("Organismos internacionales (Grupo 6)","Externo","Indicadores agregados",3,3,"Monitorear; compartir solo consultas agregadas"),
 ("Universidades e investigación (Grupo 7)","Externo","Datos anonimizados para estudios",2,3,"Monitorear; el DW no contiene datos personales"),
 ("Pacientes","Externo","Privacidad de sus datos de salud",2,2,"Monitorear: no se contactan; se protegen (sin datos personales en el DW)"),
]
def cuad(p, i):
    return "Gestionar atentamente" if p >= 4 and i >= 4 else "Mantener satisfecho" if p >= 4 else "Mantener informado" if i >= 4 else "Monitorear"
reg = "\n".join(f"| STK-{n:02d} | {r} | {t} | {e} | {p} | {i} | {cuad(p, i)} |" for n, (r, t, e, p, i, s) in enumerate(ST, 1))
est = "\n".join(f"| {r} | {e} | {cuad(p, i)} | {s} |" for r, t, e, p, i, s in ST)
pts = "\n".join(f"  STK{n:02d}: [{(i - 0.5) / 5:.2f}, {(p - 0.5) / 5:.2f}]" for n, (r, t, e, p, i, s) in enumerate(ST, 1))
COM = [  # interesado, expectativa, información, frecuencia, medio, responsable, formato
 ("Docentes","Entregables correctos y a tiempo","Entregables, reporte de estado, dudas de alcance","Según calendario; reporte cada 2 semanas","Classroom (entrega y comentario privado); correo institucional","Líder","Documento IEEE con apéndice de uso de IA; reporte de estado (plantilla S13)"),
 ("Equipo del Grupo 4","Carga repartida y bloqueos resueltos","Avance, horas reales, riesgos, decisiones","Semanal (15 min); bloqueos el mismo día","Reunión breve y chat del grupo","Líder","Reporte de estado y registro de horas"),
 ("Gestor de plataforma (Grupo 8)","Seguridad y normas cumplidas","Formato de datos, control de acceso, bitácora","Quincenal","Reunión de coordinación entre grupos","Responsable de datos","Contrato de datos (columnas, tipos, catálogos)"),
 ("Grupos 1, 2 y 3 (fuentes y hospitales)","Cargar datos sin errores","Plantilla CSV y reglas de validación","Una vez y al cambiar el formato","Chat entre grupos y Classroom","Responsable de datos","Plantilla CSV (descargable en la aplicación)"),
 ("Centros y organismos (usuarios)","Registrar rápido y sin errores","Uso de la aplicación, errores de carga por fila","Al entregar y cuando cambie","Aplicación (mensajes en pantalla) y sesión breve","Responsable de aplicación","Guía de una página y plantilla CSV"),
 ("Grupos 5, 6 y 7 (consumidores)","Datos agregados y anónimos","Resultados de consultas analíticas","Al cierre","Documento técnico y consultas del DW","Responsable de datos","Tablas agregadas sin datos personales"),
 ("Ministerio, INE y Estado (Grupo 2)","Indicadores confiables","Modelo estrella y reconciliación fuente–DW","Al cierre","Exposición final","Líder","Presentación y documento técnico"),
]
com = "\n".join("| " + " | ".join(r) + " |" for r in COM)
md03 = f"""# SISG – Módulo Grupo 4: interesados y comunicaciones

**Versión:** 0.2 (borrador) · **Corte:** 24 de octubre de 2026
> **Declaración de uso de IA:** ver el apéndice en `05_apendice_declaracion_ia.md`.

Los formatos siguen las plantillas del curso: el registro de interesados de la sesión 3 (ID, tipo, expectativa, poder e interés de 1 a 5)
y el plan de comunicaciones y el reporte de estado de la sesión 13. Los actores salen de la tabla de grupos del proyecto integral.
Poder e interés son una **valoración inicial del grupo** y deben validarse.

## 1. Registro de interesados
**TABLA I: REGISTRO DE INTERESADOS**

| ID | Nombre / rol | Tipo | Expectativa principal | Poder (1-5) | Interés (1-5) | Cuadrante |
|---|---|---|---|---:|---:|---|
{reg}

Regla de cuadrantes: alto = 4 o 5. Alto poder y alto interés → *Gestionar atentamente*; alto poder y bajo interés → *Mantener satisfecho*;
bajo poder y alto interés → *Mantener informado*; bajo poder y bajo interés → *Monitorear*.

## 2. Matriz poder / interés
```mermaid
quadrantChart
  title Poder e interés de los interesados
  x-axis "Bajo interés" --> "Alto interés"
  y-axis "Bajo poder" --> "Alto poder"
  quadrant-1 Gestionar atentamente
  quadrant-2 Mantener satisfecho
  quadrant-3 Monitorear
  quadrant-4 Mantener informado
{pts}
```

**TABLA II: ESTRATEGIA POR INTERESADO**

| Interesado | Expectativa | Cuadrante | Estrategia |
|---|---|---|---|
{est}

## 3. Plan de comunicaciones (plantilla S13)
**TABLA III: PLAN DE COMUNICACIONES**

| Interesado (a quién) | Expectativa (por qué) | Información (qué) | Frecuencia (cuándo) | Medio (cómo) | Responsable (quién) | Formato (plantilla) |
|---|---|---|---|---|---|---|
{com}

### Reglas
1. Los datos de pacientes **no** se envían por chat ni correo; solo datos sintéticos o anonimizados.
2. Un problema bloqueante se avisa el mismo día, sin esperar la reunión semanal.
3. Todo documento enviado a los docentes lleva el apéndice de declaración de uso de IA (sanción por omisión: calificación máxima del 60%).

## 4. Reporte de estado (plantilla S13) – corte 24 de octubre de 2026
| Campo | Contenido |
|---|---|
| Proyecto | SISG – Módulo Grupo 4 |
| Período | Hasta el 24 de octubre de 2026 |
| Para | Docentes de Administración de Proyectos y Bases de Datos II |
| Elabora | Equipo del Grupo 4 |
| CPI | *Pendiente: falta registrar el costo real (AC) en horas* |
| SPI | **{E['SPI']}** (EV {E['EV']} h / PV {E['PV']} h) – valor sujeto a validar los % de avance |
| EAC | *Pendiente: requiere CPI* (BAC = {E['BAC']} h) |
| Avance | **{E['avance']}%** (EV/BAC) |

**Desempeño.** Hecho: ER de las fuentes (entregado), modelo estrella y ETL, aplicación con carga masiva, MFA, roles y auditoría, 49 pruebas e2e en verde,
reconciliación fuente–DW con diferencia 0. Pendiente: presentar el diseño estrella (30 oct.), conectar el ETL con datos reales, documento técnico, informe de cierre y exposición.

**Riesgos principales.** (1) El plazo de Bases de Datos II tiene solo {C['holgura_dias']} días de holgura y ≈ {C['prob_cumplir_pct']}% de probabilidad de cumplirse (riesgo R2).
(2) Fuga de datos de salud de la aplicación (R12): controles aplicados, pendientes HTTPS y cookie HttpOnly antes de publicar. (3) Omitir la declaración de uso de IA limita la nota al 60% (R8).

**Acciones y decisiones.** Decisión tomada: el almacén es MySQL (definitivo; R1 cerrado); cada integrante completa su fila del laboratorio A1-b; registrar horas reales para calcular el CPI; adelantar el ETL con datos reales; usar el apéndice de IA en cada entrega.

Borrador generado con IA: **sí** · Verificado por: ____________________ · Fecha: ____________
"""
open(OUT + '03_interesados_comunicaciones.md', 'w').write(md03)

# ---------------- 04: riesgos y calidad ----------------
NIV = {("Baja","Alto"):"Medio",("Media","Alto"):"Alto",("Alta","Alto"):"Crítico",
       ("Baja","Medio"):"Bajo",("Media","Medio"):"Medio",("Alta","Medio"):"Alto",
       ("Baja","Bajo"):"Bajo",("Media","Bajo"):"Bajo",("Alta","Bajo"):"Medio"}   # matriz 3x3 de la sesión 10
# Categorías de la RBS de la sesión del 24 de octubre (Watt 2014, cap. 16)
CAT = ["Técnico","Costo","Cronograma","Cliente","Contractual","Clima","Financiero","Político","Ambiental","Personas"]
OBS = {"Costo":"Sin riesgo propio: no hay gasto monetario (Q 0); el costo en horas se cubre con las reservas.",
       "Clima":"Sin riesgo propio: trabajo remoto en equipos propios; la falla de equipo se trata en R9.",
       "Financiero":"No aplica: el proyecto no tiene presupuesto monetario.",
       "Político":"No identificado a nivel del prototipo académico; se revisa si cambia el alcance con otros grupos.",
       "Ambiental":"No aplica a un sistema de software de uso académico."}
RK = [  # id, categoría, riesgo, prob, impacto, el porqué, estrategia, respuesta, responsable, reserva(h)
 ("R2","Cronograma",f"La cadena de Bases de Datos II tiene {C['holgura_dias']} días de holgura y coincide con el examen final","Alta","Alto",f"holgura de {C['holgura_dias']} días y ≈ {C['prob_cumplir_pct']}% de probabilidad de cumplir; cualquier atraso la agota","Mitigar","Adelantar el ETL con datos reales y mantener el solape de la revisión con la redacción","Líder",6),
 ("R3","Técnico","Datos de salud sensibles (nombres, DPI) en el almacén de datos o en las entregas","Baja","Alto","el almacén solo recibe datos sintéticos y no tiene columnas con nombre, DPI ni teléfono; si ocurriera, el daño sería alto","Evitar","El DW no guarda datos personales; solo datos sintéticos en las entregas","Calidad",0),
 ("R4","Cliente","Otros grupos no definen sus formatos de datos a tiempo","Alta","Medio","la integración depende de cuatro grupos y no hay un formato común acordado (supuesto por confirmar)","Mitigar","Publicar un contrato de datos propio (plantilla CSV y catálogos) y dejar la integración real como exclusión","Datos",2),
 ("R5","Personas","Sobrecarga de un integrante (equipo de 3 personas)","Media","Alto","la ruta crítica no tiene reemplazos y coincide con el examen final","Mitigar","Reparto de roles y revisión semanal de horas reales","Líder",4),
 ("R6","Contractual","Crecimiento del alcance hacia funciones de la aplicación que no se evalúan","Media","Medio","ya ocurrió: el 24 de octubre se agregaron MFA, roles y auditoría; se registró como cambio de alcance (paquete 3.4)","Evitar","Control de cambios: el cambio de alcance se aprueba por el líder y se registra","Líder",0),
 ("R7","Técnico","La aplicación (Postgres) y el DW (MySQL) no se conectan","Baja","Medio","el puente existe y la reconciliación da 0; se verificó el 24 de octubre que el cambio de esquema de la aplicación no afecta las columnas que lee","Mitigar","Mitigado: `dw/run_app.sh` carga la app al DW con reconciliación en 0; repetirlo tras cada cambio de esquema","Datos",0),
 ("R8","Contractual","Omitir la declaración de uso de IA o el formato IEEE: nota máxima del 60% si el uso de IA no se declara","Media","Alto","el estándar del curso fija el tope y el campo de nivel de modificación aún está vacío","Mitigar","Apéndice de declaración preparado y lista de verificación obligatoria antes de cada entrega","Calidad",1),
 ("R9","Técnico","Falla del equipo o de Docker durante la demostración","Baja","Alto","el prototipo corre en un solo equipo con Docker","Mitigar","Capturas, video y copia de los scripts","Calidad",1),
 ("R10","Técnico","Los datos sintéticos no reflejan casos reales","Media","Bajo","los datos se generan con distribuciones simples","Aceptar","Declararlo como límite en la sustentación","Datos",0),
 ("R11","Contractual","No se leyeron los lineamientos de los entregables 2 y 3 del curso","Media","Medio","las tareas de Classroom no muestran descripción","Mitigar","Leer las instrucciones de las tareas y ajustar los documentos antes de entregar","Líder",1),
 ("R12","Técnico","Fuga de datos de salud de la aplicación (acceso o descarga masiva con credenciales robadas)","Media","Alto","el sistema guardará datos de salud y en junio de 2026 se reportó una posible exfiltración en el sector (caso de clase); los controles aplicados bajan la probabilidad pero quedan límites (sin HTTPS, sesión en el navegador)","Mitigar","Aplicado el 24 oct.: MFA obligatorio, roles, bloqueo por intentos, auditoría con exportaciones, bases solo locales y secretos fuertes. Pendiente antes de publicar: HTTPS y cookie HttpOnly","Calidad",2),
 ("R13","Personas","Suplantación (phishing o deepfake) para ordenar la exportación de la base de pacientes","Baja","Alto","caso de clase (un «viceministro» falso en videollamada); hoy cualquier usuario con acceso de lectura puede exportar, aunque cada exportación queda auditada","Mitigar","Procedimiento: colgar y llamar al número oficial antes de exportar; exportaciones auditadas; revisión semanal de la auditoría","Calidad",1),
 ("R14","Técnico","Equipos del grupo con sistemas sin parche (vulnerabilidades conocidas)","Baja","Medio","el equipo inventariado en el laboratorio A1-b está fuera del rango de CVE-2025-43300 y ya trae la corrección de CVE-2026-65395; faltan los otros dos integrantes","Mitigar","Mantener las actualizaciones al día y revisar el inventario cada mes","Líder",1),
]
NIST = [  # id, fuente de amenaza, evento, vulnerabilidad, condición predisponente, probabilidad (horizonte), impacto adverso
 ("R12","Atacante externo o usuario con credenciales robadas","Acceso o descarga masiva de datos de pacientes","Contraseñas débiles o reutilizadas, bases accesibles en la red y falta de trazabilidad (corregidas el 24 oct.); sin HTTPS ni cookie HttpOnly (pendiente)","Datos de salud de alto valor en entidades pequeñas sin equipo de seguridad","Media (6 meses desde la publicación; no aplica a la entrega académica)","Alto: daño a las personas por pérdida de confidencialidad y daño legal y de reputación a la entidad"),
 ("R13","Adversario con IA generativa","Videollamada con un «viceministro» falso que ordena exportar la base a un correo externo","No existe un procedimiento escrito para verificar órdenes de exportación","Cualquier usuario autenticado con acceso de lectura puede exportar","Baja (6 meses)","Alto: salida masiva de datos de pacientes"),
 ("R14","Error humano o explotación de un equipo sin parche","Ejecución de código al abrir una imagen manipulada (CVE-2025-43300, ImageIO)","Versión menor a la corregida: macOS Ventura < 13.7.8, Sonoma < 14.7.8, Sequoia < 15.6.1","Equipos personales sin administración central","Baja (6 meses; el equipo registrado ya está fuera del rango)","Medio: compromiso de un equipo del grupo"),
]
CONT = [  # riesgo, disparador, método alternativo, responsable
 ("R2","A 7 días del plazo, la cadena de Bases de Datos II pierde toda su holgura","Entregar el alcance mínimo (ER, modelo estrella, ETL y 8 consultas) y diferir los extras","Líder"),
 ("R5","Un integrante no puede continuar","Reasignar paquetes con la autoridad del líder y usar la reserva de gestión","Líder"),
 ("R9","Falla Docker o el equipo durante la demostración","Video y capturas preparados; copia de los scripts en otro equipo","Calidad"),
 ("R12","El sistema cae o se sospecha una fuga","Registrar los casos en la plantilla CSV (formulario sin conexión) y cargarlos después con «Importar CSV»; restablecer contraseñas y MFA de los usuarios afectados; revisar la auditoría","Calidad"),
]
NIV = {("Baja","Alto"):"Medio",("Media","Alto"):"Alto",("Alta","Alto"):"Crítico",
       ("Baja","Medio"):"Bajo",("Media","Medio"):"Medio",("Alta","Medio"):"Alto",
       ("Baja","Bajo"):"Bajo",("Media","Bajo"):"Bajo",("Alta","Bajo"):"Medio"}   # matriz 3x3 de la sesión 10
rk = "\n".join(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | **{NIV[(r[3], r[4])]}** | {r[5]} | {r[6]}: {r[7]} | {r[8]} | {r[9]} |" for r in RK)
res_total = sum(r[9] for r in RK)
cell = {(p, i): [r[0] for r in RK if r[3] == p and r[4] == i] for p in ("Baja","Media","Alta") for i in ("Alto","Medio","Bajo")}
fila = lambda i: f"| **{i}** | " + " | ".join(f"{NIV[(p, i)]}: {', '.join(cell[(p, i)]) or '—'}" for p in ("Baja","Media","Alta")) + " |"
mat = "| Impacto \\ Probabilidad | Baja | Media | Alta |\n|---|---|---|---|\n" + "\n".join(fila(i) for i in ("Alto","Medio","Bajo"))
rbs = "\n".join(f"| {c} | {', '.join(r[0] for r in RK if r[1] == c) or '—'} | " + (OBS.get(c) or "Ver la TABLA III.") + " |" for c in CAT)
nist = "\n".join("| " + " | ".join(r) + " |" for r in NIST)
cont = "\n".join("| " + " | ".join(r) + " |" for r in CONT)
md04 = f"""# SISG – Módulo Grupo 4: riesgos y plan de calidad

**Versión:** 0.2 (borrador) · **Corte:** 24 de octubre de 2026
> **Declaración de uso de IA:** ver el apéndice en `05_apendice_declaracion_ia.md`.

## 1. Gestión de riesgos (sesión 10 y sesión del 24 de octubre)
El proceso sigue el ciclo común a Watt [6], ISO 21502 (7.8) [3], PMBOK 8 (sec. 2.7) [2] y NIST SP 800-30 [5]: **preparar, conducir, comunicar y mantener**.

- **Preparar.** *Propósito:* proteger el plazo, la calidad de las entregas y los datos de salud que manejará la aplicación. *Alcance:* el módulo del Grupo 4 (aplicación, almacén de datos y documentos). *Horizonte:* hasta el 28 de noviembre de 2026 para los riesgos del proyecto y 6 meses para los de seguridad de la aplicación. *Escala:* cualitativa de tres niveles (matriz 3×3). *Fuentes:* material de las sesiones 10 y del 24 de octubre, el estándar del curso, la OPS [1] y la experiencia del grupo. *Supuesto:* las valoraciones son iniciales y las valida el grupo.
- **Conducir.** Cada riesgo se identifica con lluvia de ideas y con la lista de categorías de la RBS (TABLA II), y se evalúa con probabilidad, impacto y **el porqué** de cada valor («alto porque…»), para que otra persona llegue al mismo resultado (buena práctica de NIST). Los riesgos de seguridad se describen con el modelo de NIST: fuente de amenaza → evento → vulnerabilidad → impacto adverso, con su condición predisponente (TABLA IV). Se recuerda que **severidad no es riesgo**: una vulnerabilidad de puntaje 10.0 puede dejar un riesgo residual bajo si el equipo ya está corregido.
- **Comunicar.** Un riesgo de nivel alto o crítico se informa al docente correspondiente en la misma semana y en el reporte de estado.
- **Mantener.** La matriz se revisa cada semana y al cerrar cada sprint; el riesgo cambia con la fase: más incertidumbre al iniciar, menos al implementar y, al cierre, se registra lo ocurrido en las lecciones aprendidas.

**Riesgo cerrado.** *R1* (la docente podría exigir SQL Server): el grupo decidió el 24 de octubre que **MySQL es definitivo**; el riesgo se cierra y se libera su reserva de 4 h. La tabla de equivalencias de `dw/README.md` queda solo como referencia.

**TABLA I: MATRIZ DE PROBABILIDAD E IMPACTO (3×3)**

{mat}

### 1.1 Estructura de desglose de riesgos (RBS)
**TABLA II: RIESGOS POR CATEGORÍA**

| Categoría | Riesgos | Observación |
|---|---|---|
{rbs}

### 1.2 Registro de riesgos (amenazas)
**TABLA III: REGISTRO DE RIESGOS**

| Id | Categoría | Riesgo | Prob. | Impacto | Nivel | Porque | Estrategia y respuesta | Resp. | Reserva (h) |
|---|---|---|---|---|---|---|---|---|---:|
{rk}

### 1.3 Modelo de riesgo de NIST para los riesgos de seguridad
**TABLA IV: FUENTE, EVENTO, VULNERABILIDAD E IMPACTO**

| Id | Fuente de amenaza | Evento de amenaza | Vulnerabilidad | Condición predisponente | Probabilidad (horizonte) | Impacto adverso |
|---|---|---|---|---|---|---|
{nist}

### 1.4 Plan de contingencia
El plan de contingencia es el **método alternativo** que se aplica cuando un riesgo identificado ocurre; es distinto de los fondos de contingencia (ver Reservas).

**TABLA V: PLAN DE CONTINGENCIA**

| Riesgo | Disparador | Método alternativo | Responsable |
|---|---|---|---|
{cont}

### 1.5 Evidencia del laboratorio A1-b (datos agregados, sin información personal)
Cada integrante inventaría su equipo real y registra al menos una fila de riesgo por sistema presente más una vulnerabilidad vigente para su versión exacta (Parte B, consultada en el NVD [7]). Aquí se consolida sin nombres ni números de serie. *La base de la clase:* **CVE-2025-24054** (Windows NTLM; vulnerable si la compilación es menor que 10.0.22621.5039 en 22H2, 10.0.22631.5039 en 23H2 o 10.0.26100.3476 en 24H2) y **CVE-2025-43300** (macOS ImageIO; vulnerable si la versión es menor que 13.7.8 en Ventura, 14.7.8 en Sonoma o 15.6.1 en Sequoia; macOS 26 y 27 quedan fuera del rango).

**TABLA VI: INVENTARIO Y ESTADO DE LOS EQUIPOS DEL GRUPO**

| Integrante | Sistema y versión | Compilación | Estado frente a la vulnerabilidad base | Decisión | Parte B (CVE vigente de su versión) |
|---|---|---|---|---|---|
| 1 | macOS 27.0.1 | 26A434 | Fuera del rango afectado de CVE-2025-43300 (riesgo residual bajo) | Control aplicado: mantener las actualizaciones al día | **CVE-2026-65395** (ImageIO, escritura fuera de límites, CWE-787): una imagen manipulada puede corromper la memoria. CVSS 3.1 de 6.5 (media; AV:N, UI:R); sin explotación conocida (SSVC: ninguna; no está en el catálogo KEV). Afectaba a macOS < 15.8 y < 26.7; corregida en macOS Golden Gate 27 (fuentes: aviso de Apple y NVD, consultados el 24 de octubre). **Control aplicado:** el equipo está en 27.0.1 |
| 2 | *Por completar* | *Por completar* | *Por completar* | *Por completar* | *Por completar* |
| 3 | *Por completar* | *Por completar* | *Por completar* | *Por completar* | *Por completar* |

Mensaje de tres líneas al gerente (borrador del integrante 1; cada integrante redacta el suyo): **Riesgo:** mi equipo está fuera del rango de la vulnerabilidad crítica CVE-2025-43300, por lo que el riesgo residual es bajo. **Decisión:** mantener el equipo actualizado y revisar el inventario cada mes (control aplicado). **Costo:** sin horas adicionales a las ≈ 0.5 h mensuales de revisión.

### Oportunidades (estrategias: explotar, mejorar, compartir, aceptar, escalar)
| Id | Oportunidad | Estrategia | Respuesta |
|---|---|---|---|
| O1 | Otros grupos podrían adoptar el contrato de datos y la plantilla CSV | Compartir | Publicar la plantilla y el esquema fuente a los grupos 1–3 |
| O2 | Las pruebas e2e y la reconciliación automática acortan la verificación final | Mejorar | Ejecutarlas antes de cada entrega y registrar el resultado |

### Reservas
- **Reserva de contingencia** (riesgos identificados): las respuestas de la TABLA III suman **{res_total} h**. El 10% del BAC que sugiere la sesión 10 son {E['contingencia_10pct']} h y **no alcanza**; se fija en **{E['contingencia_pct']}% = {E['contingencia']} h** (BAC de {E['BAC']} h), que cubre las {res_total} h con {round(E['contingencia'] - res_total, 1)} h de margen.
- **Reserva de gestión** (imprevistos no identificados, bajo control del líder): {E['gestion_5pct']} h = 5% del BAC.
- Se reajusta la reserva de contingencia cuando cambia la priorización de riesgos (buena práctica de la sesión 10).

Seguimiento: revisar la matriz cada semana; un riesgo de nivel alto o crítico se informa al docente correspondiente en la misma semana.

## 2. Plan de gestión de la calidad integrado (método de la sesión 11)
La calidad se define **contra requisitos documentados** (no contra opinión) y se trata como **principio** de PMBOK 8 en los siete dominios,
con las prácticas de planificar (ISO 21502 7.11.2), asegurar (7.11.3) y controlar (7.11.4) la calidad [3]. El producto se evalúa con cuatro
características de ISO/IEC 25010:2023 [4]: adecuación funcional, fiabilidad, seguridad y usabilidad.

### 2.1 Especificaciones de calidad medibles (qué, unidad, cómo, mínimo, meta)
**TABLA VII: ESPECIFICACIÓN DE CALIDAD**

| Qué (atributo) | Unidad | Cómo se mide | Mínimo | Meta | Estado |
|---|---|---|---|---|---|
| Fiabilidad del ETL (la fuente y el DW cuadran) | Diferencia absoluta en filas y en montos | `dw/sql/07_reconciliacion.sql` después de cada carga | 0 | 0 | **Cumple (24 oct.)**: diferencia 0 |
| Adecuación funcional de la aplicación | % de pruebas e2e en verde | `npm run test:e2e` | 100% | 100% | **Cumple (24 oct.)**: 49 de 49 |
| Seguridad: confidencialidad de datos personales | Columnas con nombre, DPI o teléfono en el DW | Revisión del diccionario de dimensiones | 0 | 0 | **Cumple**: 0 columnas |
| Seguridad: autenticación | % de cuentas que necesitan un segundo factor (MFA) para obtener sesión | Pruebas e2e de MFA (token parcial sin acceso, código de un solo uso, bloqueo) | 100% | 100% | **Cumple (24 oct.)** |
| Seguridad: trazabilidad | % de cambios, inicios de sesión y exportaciones desde la interfaz que quedan en la auditoría, con su autor | Pruebas e2e de bitácora y exportación | 100% | 100% | **Cumple (24 oct.)**; límite: la exportación se registra desde el cliente |
| Seguridad: aislamiento entre entidades | Intentos de acceso cruzado que se rechazan | Pruebas e2e de aislamiento (404/403) | 100% | 100% | **Cumple** |
| Usabilidad (calidad percibida) | % de personas que registran un paciente sin ayuda | Sesión con 3 a 5 personas y casos de práctica | 80% | 95% | *Pendiente de medir* |
| Eficiencia de desempeño | Segundos de una consulta analítica con ≈ 12,000 estudios | Tiempo de ejecución y `EXPLAIN` (consultas 1 y 8) | menos de 2 s | menos de 0.5 s | *Pendiente de medir* |

Los mínimos y metas de usabilidad y desempeño son propuestas del grupo (ilustrativas); deben validarse antes de usarse como criterio de aceptación.

### 2.2 Integración de la calidad en los siete dominios de PMBOK 8
**TABLA VIII: CALIDAD EN LOS DOMINIOS**

| Dominio | Pregunta de calidad | Aplicación en SISG |
|---|---|---|
| Gobernanza | ¿Se auditan los procesos y se mejora continuamente? | Auditoría en la aplicación (quién hizo qué y cuándo) y revisión semanal del grupo |
| Alcance | ¿Cada requisito tiene criterio de aceptación y cómo se valida? | Criterios de aceptación por entregable (`01_acta_y_alcance.md`, B.3) |
| Cronograma | ¿La prevención y las pruebas están dentro de cada entregable? | Pruebas e2e y reconciliación se ejecutan antes de cada entrega (paquetes 4.1 y 4.2) |
| Finanzas | ¿Se presupuestó el costo de la calidad? | Paquetes 4.1 a 4.3 suman 17 h de {E['BAC']} h de presupuesto |
| Interesados | ¿La percepción del usuario se traduce en requisitos medibles? | Sesión de usabilidad y especificación de "facilidad de uso" (TABLA VII) |
| Recursos | ¿El equipo tiene capacitación y herramientas desde el inicio? | Docker y scripts reproducibles (`run.sh`, `run_app.sh`); revisión por pares |
| Riesgo | ¿Qué defectos detectados tarde tendrían mayor impacto? | Un error en el ETL falsea todos los indicadores: por eso la reconciliación es obligatoria (R3, R8); y una fuga de datos tendría el mayor impacto (R12) |

### 2.3 Actividades de aseguramiento y control
1. **Planificar (7.11.2):** especificaciones de la TABLA VII y criterios por entregable.
2. **Asegurar (7.11.3):** revisión por pares con lista de verificación (alcance, formato IEEE, apéndice de IA) y ejecución completa desde cero antes de entregar.
3. **Controlar (7.11.4):** pruebas e2e, reconciliación fuente–DW, registro de defectos y su corrección.

### 2.4 Defectos encontrados y corregidos durante el desarrollo
**TABLA IX: REGISTRO DE DEFECTOS**

| Defecto | Causa | Corrección |
|---|---|---|
| Las consultas se ejecutaban antes del ETL | Orden de scripts en `run.sh` | El ETL corre antes; las consultas van aparte |
| La tabla de sumarización era casi tan grande como el hecho (10,106 filas) | Grano demasiado fino (incluía geografía) | Se quitó la geografía; quedó en ≈ 1,800 filas |
| Los pacientes sin municipio perdían su departamento (80 estudios en "Desconocido") | El mapeo guardaba solo el municipio | Se guarda el departamento aparte; bajó a 40 (los que no traen ningún lugar) |
| `docker-compose.yml` quedó vacío tras una edición | Se abrió el archivo para escribir antes de leerlo | Se restauró; se revisa que ningún archivo quede en 0 bytes |

## Referencias
[1] Organización Panamericana de la Salud, *Bases para la construcción del Marco de Arquitectura de Salud Pública para Guatemala: Línea de base*, OPS/OMS Guatemala, 2024.
[2] Project Management Institute, *Guía de los Fundamentos para la Dirección de Proyectos (Guía del PMBOK)*, 8.ª ed., 2025.
[3] ISO, *ISO 21502:2020 – Project, programme and portfolio management – Guidance on project management*, 2020.
[4] ISO/IEC, *ISO/IEC 25010:2023 – Systems and software quality models*, 2023.
[5] Joint Task Force, *NIST SP 800-30 Rev. 1: Guide for Conducting Risk Assessments*, National Institute of Standards and Technology, 2012.
[6] A. Watt, *Project Management*, cap. 16, BCcampus, 2.ª ed., 2014.
[7] NIST, *National Vulnerability Database (NVD)*, https://nvd.nist.gov, consultado el 24 de octubre de 2026.
[8] Apple, *About the security content of macOS Golden Gate 27*, 14 de septiembre de 2026 (entradas actualizadas el 19 de octubre), https://support.apple.com/en-us/149035.
"""
open(OUT + '04_riesgos_calidad.md', 'w').write(md04)
json.dump({'res_total': res_total}, open('reserva.json', 'w'))
print(len(md03), len(md04), "reserva usada:", res_total, "de", E['contingencia_10pct'])
