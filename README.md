# SISG – Sistema Integral de Salud de Guatemala (módulo del Grupo 4)

Módulo para **centros de diagnóstico** y **organismos no lucrativos**: registro de pacientes, estudios diagnósticos y campañas de salud, con autenticación en dos pasos (MFA), roles, auditoría y un almacén de datos para análisis.
Proyecto de Universidad San Pablo de Guatemala (Bases de Datos II y Administración de Proyectos Tecnológicos).

| Carpeta | Contenido |
|---|---|
| `backend/` | API (NestJS + PostgreSQL): autenticación con MFA, roles, usuarios, pacientes, estudios, campañas, auditoría y carga masiva por CSV. Pruebas: `npm run test:e2e`. |
| `nuevo-diseño/` | Interfaz (TanStack Start + React + Tailwind). |
| `dw/` | Almacén de datos en MySQL: esquema fuente, modelo estrella, ETL, reconciliación y consultas (`README.md` y `DISENO_ESTRELLA.md`). |
| `docs/gestion/` | Documentos de gestión del proyecto (acta, EDT, riesgos, calidad…) y el Word en formato IEEE. |
| `docker-compose.yml`, `DESPLIEGUE.md` | Despliegue en un VPS con Coolify. |

## Desarrollo local
```bash
# Base de datos y API
cd backend && cp .env.example .env     # complete los valores (ver comentarios del archivo)
docker compose up -d && npm install && npm run start:dev

# Interfaz (otra terminal)
cd nuevo-diseño && npm install && npm run dev      # http://localhost:8080
```
Se necesitan `JWT_SECRET` (mínimo 32 caracteres) y `MFA_KEY` (32 bytes en base64); la API no arranca sin ellos. No hay registro público: el superadministrador (`SUPERADMIN_CORREO` y `SUPERADMIN_PASSWORD`, que se crea al primer arranque) da de alta cada entidad y le entrega un enlace de invitación de un solo uso (72 h), con el que crea su contraseña. El MFA es obligatorio.

## Producción
Ver [`DESPLIEGUE.md`](DESPLIEGUE.md).
