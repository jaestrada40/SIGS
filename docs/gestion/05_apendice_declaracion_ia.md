# Apéndice A. Declaración de uso de IA

Formato exigido por el *Estándar de Declaración de uso de IA para Estudiantes* del curso de Administración de Proyectos Tecnológicos:
sin esta declaración, el uso de IA hace que la entrega obtenga como máximo el **60%** de la puntuación.

> **Borrador para que el grupo lo revise y complete.** Las partes marcadas con ⚠ solo las puede responder el grupo con honestidad;
> no las rellené porque no sé cuánto de este material revisaron y modificaron.

## Declaración (aplica a los documentos de `docs/gestion/` y a `dw/`)

| Campo | Declaración |
|---|---|
| **Herramienta utilizada** | Claude Code, con el modelo Claude Sonnet 5.5 (Anthropic) |
| **Prompt** | El asistente trabajó a partir de instrucciones del grupo en una conversación (no un único prompt). Resumen: (1) revisar y mejorar el diseño de la aplicación; (2) leer el material de Classroom de Bases de Datos II y Administración de Proyectos; (3) diseñar el almacén de datos del proyecto (ER, modelo estrella, ETL y consultas); (4) redactar los documentos de gestión con las plantillas y sesiones del curso; (5) agregar carga masiva, bitácora y diseño adaptable a la aplicación; (6) agregar a la aplicación autenticación con segundo factor (MFA), roles, gestión de usuarios, auditoría con exportaciones y validación de datos de pacientes; (7) rehacer el capítulo de riesgos y el plan híbrido con lo visto en la sesión del 24 de octubre, a partir de capturas de pantalla de las diapositivas que compartió el grupo. ⚠ *Adjunten el historial completo de la conversación si el docente pide los prompts literales.* |
| **Propósito del uso** | Generar borradores de documentos (acta, alcance, EDT, cronograma, interesados, comunicaciones, riesgos, calidad, enfoque híbrido); escribir y probar el código SQL y de la aplicación (incluidas 49 pruebas automáticas); consultar con herramientas web el NVD y el aviso de seguridad de Apple para la Parte B del laboratorio A1-b; leer las capturas de la clase y extraer los métodos (RBS, NIST SP 800-30, plan de contingencia, laboratorio A1-b); calcular la ruta crítica, el PERT y el valor ganado con un script; buscar errores y corregirlos. |
| **Secciones afectadas** | `docs/gestion/01` a `04` (todas las secciones; el capítulo de riesgos de `04` se reescribió con la RBS, el modelo de NIST, el plan de contingencia y la evidencia del laboratorio A1-b; el enfoque híbrido está en `02`, sección 6); `dw/` (scripts SQL, README y diseño estrella); `backend/` (carga masiva, bitácora, MFA, roles, usuarios, auditoría y validaciones); `nuevo-diseño/` (interfaz). Los números de los documentos 02 a 04 salen de un script de cálculo (`plan.py`), no se escribieron a mano. |
| **Nivel de modificación** | ⚠ *Completar:* indicar el porcentaje o la descripción de lo que el grupo revisó, corrigió o reescribió manualmente. Ejemplo del estándar: "el texto sugerido por la IA fue modificado manualmente en un X% para ajustar …". Hasta la fecha de este borrador **el grupo no había modificado manualmente estos documentos**, y debe declarar el nivel real. |

## Datos que la IA estimó y el grupo debe validar
Horas por paquete de trabajo, porcentajes de avance, valores optimista/probable/pesimista (PERT), poder e interés de los interesados,
probabilidad, impacto y el «porqué» de los riesgos (incluidos R12 a R14), las 12 horas del paquete 3.4 (seguridad y usuarios) y los mínimos y metas de usabilidad y desempeño. La fila del integrante 1 del laboratorio A1-b salió de su captura de pantalla; **la Parte B (vulnerabilidad vigente de su versión) y las filas de los otros integrantes las debe completar cada persona**: el laboratorio es individual. Son estimaciones iniciales, no mediciones.

## Si algún documento se entrega sin usar IA
El estándar exige declararlo de forma explícita: *"No se utilizó IA en este documento."*

## Nota para Bases de Datos II
El estándar leído es el de Administración de Proyectos. Conviene preguntar a la docente de Bases de Datos II si exige la misma declaración
para los scripts SQL y el documento técnico; mientras tanto, usar este mismo apéndice es la opción segura.
