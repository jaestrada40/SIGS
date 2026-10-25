# Despliegue de SISG en un VPS con Coolify (Hostinger)

El repositorio incluye un `docker-compose.yml` de producción con tres servicios:

| Servicio | Qué es | Puerto interno | Dominio sugerido |
|---|---|---|---|
| `frontend` | Interfaz (carpeta `nuevo-diseño/`, servidor Node con renderizado en servidor) | 3000 | `app.sudominio.com` |
| `backend` | API (carpeta `backend/`, NestJS) | 3000 | `api.sudominio.com` |
| `db` | PostgreSQL 16 (solo accesible dentro de la red del compose) | 5432 | ninguno |

Cada aplicación tiene su `Dockerfile` (`backend/Dockerfile` y `nuevo-diseño/Dockerfile`), por si prefiere desplegarlas como aplicaciones separadas de Coolify. El almacén de datos MySQL (`dw/`) es una herramienta de análisis local y **no** se despliega.

## 1. Antes de empezar
1. Un VPS con Coolify instalado y dos nombres de dominio apuntando a la IP del VPS (registros **A**): uno para la interfaz y otro para la API.
2. El repositorio en GitHub (se recomienda **privado**) y Coolify conectado a su cuenta de GitHub.
3. Los secretos generados (ver `.env.example`):
   ```bash
   openssl rand -hex 32      # JWT_SECRET
   openssl rand -base64 32   # MFA_KEY
   openssl rand -hex 24      # DB_PASS
   ```

## 2. Pasos en Coolify
1. **New Resource → Private/Public Repository** y elija el repositorio y la rama `main`.
2. **Build Pack: Docker Compose**; ubicación del archivo: `/docker-compose.yml`.
3. En **Environment Variables** cargue todas las variables de `.env.example` con sus valores reales (`DB_USER`, `DB_PASS`, `JWT_SECRET`, `MFA_KEY`, `FRONTEND_URL`, `API_URL`; `LOVABLE_API_KEY` es opcional).
4. En la configuración de cada servicio asigne el **dominio** con `https://`:
   - `frontend` → `https://app.sudominio.com` (puerto 3000)
   - `backend` → `https://api.sudominio.com` (puerto 3000)

   Coolify emite el certificado HTTPS (Let's Encrypt) y enruta con su proxy.
5. **Deploy**. La primera construcción tarda unos minutos.

## 3. Comprobar que quedó bien
- `https://api.sudominio.com/salud` responde `{"estado":"ok"}`.
- Abra `https://app.sudominio.com`, vaya a **Registrar entidad**, cree la cuenta y configure el MFA con su app autenticadora. Guarde los códigos de recuperación.
- La primera cuenta de cada entidad es **Administrador**; desde **Usuarios** se crean los demás.

## 4. Cosas que debe saber
- **`API_URL` se incorpora al compilar la interfaz.** Si cambia el dominio de la API, cambie la variable y **vuelva a desplegar con reconstrucción** (no basta con reiniciar).
- **`FRONTEND_URL` debe ser exactamente el dominio de la interfaz** (con `https://`): es el único origen que la API acepta por CORS.
- **Esquema de la base de datos (`DB_SYNC`).** El valor predeterminado de producción es `false` para evitar cambios automáticos del esquema. En una base nueva, configure temporalmente `DB_SYNC=true` para crear las tablas, haga un respaldo y vuelva a `false`; no lo active durante despliegues normales porque la sincronización automática puede borrar columnas que ya no existan en el código.
- **Respaldo.** La base vive en el volumen `sisg_pgdata`. Haga copias periódicas, por ejemplo con una tarea programada de Coolify:
  ```bash
  docker exec <contenedor-db> pg_dump -U "$DB_USER" "$DB_NAME" | gzip > sisg_$(date +%F).sql.gz
  ```
- **`MFA_KEY`** cifra los secretos del MFA. Si se pierde o se cambia, nadie podrá usar su código y habrá que restablecer el MFA de todos los usuarios. Guárdela en un lugar seguro.
- **IP real del cliente.** `TRUST_PROXY=1` hace que el bloqueo por intentos fallidos y el límite de peticiones usen la IP del cliente y no la del proxy. No lo quite detrás de Coolify.

## 5. Límites conocidos (antes de usar datos reales de pacientes)
- La sesión autenticada se mantiene en una cookie `HttpOnly`, `Secure` y `SameSite=Strict`; el navegador solo conserva metadatos no sensibles de la interfaz.
- No hay recuperación de contraseña por correo: un administrador la restablece desde **Usuarios**.
- Sin migraciones de base de datos ni respaldo automático (ver arriba).
- La exportación a CSV se registra en la auditoría desde el navegador; no se genera en el servidor.

## 6. Actualizar y volver atrás
- **Actualizar:** suba cambios a `main` y haga **Redeploy** en Coolify (o active el despliegue automático por webhook).
- **Volver atrás:** en Coolify, despliegue un commit anterior. Si el esquema cambió, restaure también el respaldo de la base.
