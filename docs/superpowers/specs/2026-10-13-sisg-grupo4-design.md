# SISG - Módulo Grupo 4 (Centros de diagnóstico y Organismos no lucrativos)

## Objetivo
Backend NestJS + Postgres con login, que sirve las pantallas de Stitch (`diseno-stitch/*.html`) como estáticos.
Dos actores: **Centro de diagnóstico** y **Organismo no lucrativo** (Liga del Corazón, Pulmones, APROFAM, INCAN). Ambos alimentan y consumen datos.

## Decisiones (acordadas)
- Auto-registro de entidad (pantalla `login.html`). Sin Gestor de plataforma por ahora.
- Cada entidad solo ve y edita sus propios registros (pacientes incluidos).
- Un solo proyecto NestJS. El HTML de Stitch se sirve con `ServeStaticModule` y llama a la API con `fetch`. Sin React.
- Auth: JWT (`sub` = entidadId, `tipo` = tipo de entidad), contraseñas con bcrypt.

## Fuera de alcance
Rol Administrar (Grupo 8), reportes, integración con otros grupos, versiones móviles de Stitch, recuperación de contraseña.

## Modelo de datos (TypeORM)
- `entidad`: id, nombre, tipo (`CENTRO_DIAGNOSTICO` | `ORG_NO_LUCRATIVA`), departamento, telefono, correo (único), passwordHash.
- `paciente`: id, entidadId, nombreCompleto, dpi, fechaNacimiento, sexo (`F`|`M`|`NE`), departamento, municipio, telefono, contactoEmergencia, estado.
- `estudio` (solo CENTRO_DIAGNOSTICO): id, entidadId, pacienteId, tipoEstudio, salaEquipo, fecha, hora, especialista, resultado, estado.
- `campana` (solo ORG_NO_LUCRATIVA): id, entidadId, nombre, area (`CARDIOVASCULAR`|`RESPIRATORIA`|`PLANIFICACION`|`ONCOLOGICO_OTRO`), departamento, ubicacion, fechaInicio, fechaFin, personasAtendidas, estado (`PROGRAMADA`|`EN_CURSO`|`FINALIZADA`).

## API
- `POST /auth/registro`, `POST /auth/login`
- `GET|POST /pacientes`, `GET|PATCH /pacientes/:id`
- `GET|POST /estudios`, `GET|PATCH /estudios/:id` (403 si tipo != CENTRO_DIAGNOSTICO)
- `GET|POST /campanas`, `GET|PATCH /campanas/:id` (403 si tipo != ORG_NO_LUCRATIVA)
- `GET /dashboard`: totales de la entidad.
- Todas menos auth exigen JWT. Todas las consultas filtran por `entidadId` del token; un id ajeno devuelve 404.
- DTOs con `class-validator`.

## Pruebas
Un e2e por recurso (supertest + Postgres de prueba): registro/login, aislamiento entre entidades, 403 por tipo.

## Riesgos
- Auto-registro abierto: cualquiera puede crear una entidad. Aceptado por ahora.
- Datos de salud: usar HTTPS y `JWT_SECRET` fuerte fuera de desarrollo.
- Los HTML de Stitch traen datos de ejemplo fijos; hay que reemplazarlos por llamadas a la API pantalla por pantalla.
