# SISG · Preguntas probables de Administración de Proyectos (con respuesta)

Fuente: `Proyecto final grupo 4.pdf` (datos al 24 de octubre de 2026, secciones 1 y 2). Si el repositorio ya tiene datos más recientes (horas reales, usabilidad medida), usar esos.

## 1. Alcance y acta
- **¿Propósito?** Registrar pacientes, estudios y campañas de centros de diagnóstico y organismos no lucrativos, y dejar los datos listos para analizar en un almacén con modelo estrella.
- **¿Objetivos SMART?** Específicos, medibles y con fecha. Ej. (O3): ETL con reconciliación fuente–DW con diferencia 0 antes del 5 de noviembre.
- **¿Criterios de éxito?** Reconciliación con diferencia 0, 49 de 49 pruebas e2e, 0 columnas con datos personales, declaración de IA en todo, 2 días de holgura, usabilidad de al menos 80%.
- **¿Fuera del alcance?** Integración real con otros grupos, producción con HTTPS, recuperación de contraseña, carga incremental, BI externo, apps móviles.
- **¿Hubo control de cambios?** Sí. El 24 de octubre se agregaron MFA, roles y auditoría; lo aprobó el líder y se registró como cambio de alcance (paquete 3.4, riesgo R6).
- **¿Por qué híbrido?** Los entregables de BD II (ER, estrella, ETL, consultas) son predictivos: contenido y fecha fijos. La aplicación es ágil: backlog y sprints.
- **¿Trazabilidad?** Cada entregable se rastrea a un objetivo: ER→O1, estrella→O2, ETL→O3, consultas→O4, documentos→O5, exposición→O6.
- **¿Director y autoridad?** Jonathan Soberanis. Aprueba cambios de alcance, reasigna paquetes, usa las reservas y escala a los docentes.
- **¿Patrocinadores?** Ing. Barrios (Administración de Proyectos) e Inga. Alegre (BD II).

## 2. EDT, cronograma y ruta crítica
- **EDT y regla del 100%:** desglose jerárquico del trabajo; los paquetes de nivel 2 suman todo el alcance del nivel 1, sin más ni menos.
- **Total de horas:** BAC = 168 h.
- **PDM:** diagrama por precedencia (actividades en nodos). Relaciones fin-a-inicio y un solape K(−2) entre revisión y documento técnico.
- **Ruta crítica de BD II:** B→C→D→E→K→L, termina el 25 de nov. con 2 días de holgura frente al 28 a las 8:00. J (exposición) tiene holgura 0 porque su fecha es fija.
- **Holgura:** LS − ES (o LF − EF). Recorrido hacia adelante da ES/EF; hacia atrás, LS/LF.
- **PERT:** esperado = (O + 4M + P)/6; desviación = (P − O)/6.
- **¿Por qué 74%?** Suma de esperados 33.8 − 2 por solape = 31.8 d; σ = √(suma de varianzas) = 1.91; disponibles 33 → z = (33 − 31.8)/1.91 = 0.63 ≈ 74%.
- **¿Cómo subirla?** Empezar el ETL con datos reales ya (C), no esperar la presentación del 30 oct. (B), mantener el solape de K con E.
- **¿Y si se atrasa más de 2 días una actividad crítica?** Se incumple la entrega. Contingencia: alcance mínimo (ER, estrella, ETL y 8 consultas).

## 3. Costos y valor ganado
- **Unidad:** horas-persona (no hay gasto monetario, Q 0).
- **Fórmulas:** CPI = EV/AC · SPI = EV/PV · EAC = BAC/CPI · avance = EV/BAC.
- **Valores:** BAC 168 · PV 86.6 · EV 110.1 · SPI 1.27 (adelantados) · avance 66%.
- **Reservas:** contingencia 21.8 h (13%, riesgos identificados) y gestión 8.4 h (5%, imprevistos). Total con reservas: 198.2 h.
- **¿Por qué 13% y no 10%?** La clase sugiere 10% (16.8 h), pero las respuestas a los riesgos suman 19 h; no alcanzaba.
- **Reserva vs plan de contingencia:** la reserva son horas para riesgos conocidos; el plan es el método alternativo cuando el riesgo ocurre.

## 4. Interesados y comunicaciones
- **Matriz poder/interés (1 a 5; alto = 4 o 5):** alto/alto → gestionar atentamente (docentes, equipo, Grupo 8, Ministerio, hospitales) · bajo poder/alto interés → mantener informado · alto poder/bajo interés → mantener satisfecho · bajo/bajo → monitorear.
- **Grupo 8:** gestor de plataforma, poder 5, interés 4; coordinación quincenal.
- **Pacientes:** monitorear (poder 2, interés 2), pero se protegen: no se contactan y el DW no guarda datos personales.
- **Plan de comunicaciones:** por interesado, qué, cuándo, medio, responsable y formato. Docentes: reporte cada 2 semanas. Equipo: reunión semanal de 15 min.
- **Reglas:** no se envían datos de pacientes por chat ni correo; un bloqueo se avisa el mismo día; todo documento lleva el apéndice de IA.
- **Reporte de estado (plantilla S13):** CPI, SPI, EAC, avance, desempeño, riesgos principales, acciones y decisiones.

## 5. Riesgos (lo más preguntado)
- **Proceso:** preparar, conducir, comunicar, mantener (Watt, ISO 21502, PMBOK 8, NIST SP 800-30).
- **Matriz 3×3:** probabilidad × impacto. El único crítico es R2 (poca holgura; 74% de probabilidad de cumplir).
- **RBS:** técnico, cronograma, cliente, contractual, personas; en costo, clima, financiero, político y ambiental no hay riesgo propio y se justifica.
- **Altos:** R2 plazo, R12 fuga de datos de salud, R5 sobrecarga, R8 omitir declaración de IA (nota máx. 60%), R4 otros grupos sin formatos.
- **Estrategias:** evitar (R3 sin datos personales en el DW; R6 control de cambios) · mitigar (R2, R4, R5, R12) · aceptar (R10 datos sintéticos simples, se declara como límite) · transferir (no aplica).
- **"Severidad no es riesgo":** una vulnerabilidad 10.0 puede dejar riesgo residual bajo si el equipo ya está corregido (caso CVE-2025-43300).
- **Modelo NIST (tabla IV):** fuente de amenaza → evento → vulnerabilidad → condición predisponente → probabilidad → impacto (R12, R13, R14).
- **R1 cerrado:** el 24 de oct. se decidió que MySQL es definitivo; se liberaron sus 4 h.
- **Oportunidades:** O1 compartir la plantilla CSV con otros grupos; O2 mejorar la verificación con pruebas automáticas.
- **Laboratorio A1-b:** equipo macOS 27.0.1, fuera del rango de CVE-2025-43300 (< 15.6.1 en Sequoia) y con la corrección de CVE-2026-65395.
- **R13 (deepfake):** hoy cualquier usuario con lectura puede exportar; procedimiento: colgar y llamar al número oficial antes de exportar.

## 6. Calidad
- **Definición:** contra requisitos documentados, no contra opinión.
- **ISO/IEC 25010 (5 características):** adecuación funcional, fiabilidad, seguridad, usabilidad, eficiencia de desempeño.
- **PMBOK:** planificar (7.11.2), asegurar (7.11.3: revisión por pares y ejecución desde cero), controlar (7.11.4: e2e, reconciliación, registro de defectos).
- **Cumplido:** ETL diferencia 0, 49/49 pruebas, 0 columnas con datos personales, MFA 100%, aislamiento entre entidades.
- **Usabilidad:** planificada, no ejecutada (3 a 5 personas, SUS). Mínimo aceptable 80%; meta 95%.
- **Eficiencia:** consulta 1 ≈ 11.1 ms, consulta 8 (sumarización) ≈ 1.6 ms, unas 7 veces más rápida.
- **Defectos corregidos:** consultas corrían antes del ETL · sumarización casi tan grande como el hecho · pacientes sin municipio perdían el departamento · `docker-compose.yml` quedó vacío tras una edición.

## 7. Ágil, normas e IA
- **Definition of Done:** resultado verificable que cierra un sprint (ej. Sprint 3: reconciliación fuente–DW con diferencia 0 con datos reales).
- **Review y retrospectiva:** al cierre de cada sprint, anotadas en el reporte semanal.
- **Sprints sin solape:** primero se verifica el modelo, luego se construyen las consultas; si uno se atrasa, se mueve el siguiente.
- **Declaración de IA:** sin ella la nota máxima es 60% (R8). Indica qué documentos usaron IA y qué datos estimó la IA y deben validarse.

---

## Debilidades que pueden señalar (respuestas listas)

**1. CPI y EAC son supuestos**
> "No llevamos registro de horas reales (AC), así que en la presentación CPI y EAC figuran como pendientes. Si asumimos AC = EV, el CPI sería 1.00 y el EAC igual al BAC de 168 h, pero es un supuesto, no una medición. La lección es que el valor ganado exige registrar horas desde el día uno. Para el cierre, cada integrante reporta sus horas reales y recalculamos CPI y EAC."

**2. SPI de 1.27 depende de porcentajes estimados**
> "Calculamos EV con el porcentaje de avance que el grupo estimó por paquete, y PV con la fracción del plazo transcurrido. Por eso el SPI de 1.27 indica que vamos adelantados, no es un dato exacto. Lo respalda que los entregables verificables sí están hechos: ER entregado, 49 de 49 pruebas en verde y reconciliación en 0."

**3. Las estimaciones PERT las propuso el borrador**
> "Los valores optimista, probable y pesimista son estimaciones iniciales hechas con el borrador, y las declaramos así en el documento. La fórmula y el procedimiento están bien: esperado 31.8 días, σ de 1.91 y z de 0.63, que da ≈74%. Si los valores cambian, el resultado cambia. Lo que no cambia es la conclusión: la holgura es corta y por eso adelantamos el ETL."

**4. La usabilidad no se ha medido**
> "Está planificada, no ejecutada. Tenemos el protocolo: 3 a 5 personas, tareas con datos ficticios y cuestionario SUS. El mínimo es que 80% registre un paciente sin ayuda; la meta es 95%. La marcamos como planificada y no como cumplida, para no reportar un resultado que no tenemos."

**5. Faltan las filas del laboratorio A1-b de los integrantes 2 y 3**
> "El inventario del integrante 1 está completo: macOS 27.0.1, fuera del rango de CVE-2025-43300 y con la corrección de CVE-2026-65395. Los otros dos integrantes tienen que completar su fila con su equipo y un CVE vigente. El riesgo R14 sigue en nivel bajo mientras tanto."
*(Antes de exponer: completar esas dos filas con datos reales.)*

**6. Responsables por rol, no por persona**
> "En el documento Word están nombrados: Jonathan Soberanis es líder, Jonathan Jolón es responsable de datos y Javier Estrada es responsable de aplicación y calidad. En la EDT y los riesgos usamos el rol (Líder, Datos, Calidad) para que el plan siga valiendo si se reasignan paquetes; esa es la base de la contingencia del riesgo R5."

**Cierre para cualquiera:** "Lo declaramos como supuesto en el documento. Prefiero reportarlo así que presentarlo como medido."

---
## Notas de coherencia (revisar antes de exponer)
- **Roles y CPI/EAC ya están unificados** en el acta, los documentos de gestión, `PRESENTACION_APT.html` y la presentación `SISG-AP`: líder Soberanis, datos Jolón, aplicación y calidad Estrada; CPI 1.00 y EAC 168 h como **supuesto** (AC = EV, sin horas reales).
- **Pruebas:** 49 de 49 es al 24 de oct.; hoy son 103. Decir la fecha.
- **Declaración de IA:** el campo "Nivel de modificación" sigue por completar; sin él, la nota máxima es 60%. Es el pendiente más importante.
- **No afirmar** que hay cifrado como mitigación, ni que la Definition of Done exige rastrear código de IA: no están en los documentos.
