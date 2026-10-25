# Funciones diferenciales de SISG

Qué hace el sistema que un registro de pacientes común no hace, y dónde están sus límites. Se escribió para poder decirlo sin exagerar.
No se comparó con productos de la competencia: ninguna frase de aquí afirma que "otros no lo tienen".

## 1. Ciclo campaña → referido → estudio → resultado
- El organismo refiere a una persona a un centro de diagnóstico (`/referidos`). Marca que la persona autorizó compartir sus datos; queda la fecha del consentimiento.
- El centro recibe una copia mínima (nombre, DPI, fecha de nacimiento, sexo, teléfono, estudio y motivo), agenda o marca «No llegó». Al agendar se crea la persona y el estudio en el centro.
- Al marcar el estudio como realizado, el referido pasa solo a «Atendido». El organismo ve el estado, **nunca el resultado clínico**.
- Límite: una persona por referido; no hay notificaciones automáticas al organismo (ve el estado al abrir la pantalla).

## 2. Indicadores de impacto y de negocio (`/impacto`)
- Centro: ingresos, cobro promedio, cancelación, estudios por mes y tipo, referidos recibidos, perfil de pacientes.
- Organismo: personas atendidas, costo por persona, inversión, personas por mes/área/departamento, referidos y su tasa de llegada.
- Usa los campos opcionales `monto` (estudio) y `costo` (campaña). Cada cifra indica con cuántos registros se calculó; el costo por persona solo usa campañas con costo y personas.
- Solo administrador y auditor. Exporta CSV (auditado) e imprime a PDF para donantes.
- Se calcula en vivo sobre la base de la aplicación (PostgreSQL), no sobre el almacén MySQL del curso.

## 3. Modo sin conexión para jornadas (`/jornada`)
- Registra personas atendidas sin internet. Cada registro se cifra (AES-GCM, clave derivada con PBKDF2 de una contraseña de jornada) antes de guardarse en el dispositivo y se envía solo al volver la señal.
- La sincronización es idempotente (clave generada en el dispositivo): reenviar no duplica. Una persona cuenta una sola vez por campaña; los registros rechazados quedan visibles con su motivo.
- Límites: **la contraseña de jornada no se puede recuperar**; hay que abrir la pantalla una vez con señal para dejarla disponible sin conexión; solo registra personas/atenciones (no estudios ni edición); la protección es contra quien copie los datos del navegador, no contra quien conozca la contraseña o un dispositivo ya comprometido.
- Si la sesión caduca durante la jornada, al iniciar sesión de nuevo y volver a la pantalla lo pendiente se envía.

## 4. Exportación FHIR (subconjunto)
- `GET /fhir/Patient`, `/fhir/DiagnosticReport`, `/fhir/Organization` devuelven un Bundle FHIR R4 (`application/fhir+json`).
- Es un **subconjunto**: sin búsqueda ni escritura, estudios solo como texto (sin LOINC/SNOMED), sin separar apellidos, y el DPI usa un identificador provisional (`urn:gt:renap:cui`). No debe describirse como «compatible con FHIR» sin más.
- Solo administrador y auditor; cada descarga queda en la auditoría.

## 5. Avisos a la persona y alertas
- Recordatorio de cita por WhatsApp (enlace `wa.me` con el mensaje listo; la persona del centro decide enviarlo). El mensaje no menciona el tipo de estudio.
- Enlace seguro de resultado: el token se muestra una sola vez y en la base solo se guarda su hash; vence (1 a 30 días), se puede revocar, exige fecha de nacimiento o últimos 4 del DPI, se bloquea tras 5 fallos, está limitado por IP y la página no se indexa ni se guarda en caché. Los accesos (y los intentos fallidos) quedan en la auditoría.
- Alertas en Inicio: estudios vencidos, sin resultado o sin monto, referidos sin agendar o sin atender, campañas vencidas o sin costo.
- Límite: el enlace de resultado entrega el texto que el centro escribió; el centro debe decidir qué resultados compartir así.

## Antes de desplegar
Los cambios agregan tablas y columnas (`referido`, `enlace_resultado`, `atencion`, `estudio.monto`, `campana.costo`). El proyecto no tiene migraciones y en producción `DB_SYNC` está en `false` por defecto, así que **la base de producción no las creará sola**. En el primer despliegue con estos cambios hay que arrancar el backend una vez con `DB_SYNC=true` (y volver a `false`), o crear las tablas a mano. Haga antes una copia de la base.
