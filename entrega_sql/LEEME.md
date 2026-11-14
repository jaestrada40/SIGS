# SQL de SISG para abrir en otra computadora

Dos archivos, dos bases. Los datos son de ejemplo y sintéticos (sin datos personales reales).

| Archivo | Crea | Contenido |
|---|---|---|
| `1_sisg_aplicacion.sql` | base `sisg` | La aplicación (OLTP): 9 tablas con 2 entidades, 6 usuarios, 65 pacientes, 91 estudios, 6 campañas y 18 referidos |
| `2_sisg_almacen_datos.sql` | bases `sisg_fuente` y `sisg_dw` | El almacén: ER de la fuente, modelo estrella, vistas `v_*`, procedimientos del ETL y triggers. 12,507 estudios y 150 campañas |

No incluyen usuarios de MySQL ni el superadministrador de la aplicación. Son MySQL 8; probados en MySQL 8.0 limpio.

## Opción A: con Docker (recomendada)

```bash
docker run -d --name sisg-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=sisg_dev mysql:8.0
# esperar unos 20 segundos a que arranque
docker exec -i sisg-mysql mysql -uroot -psisg_dev --default-character-set=utf8mb4 < 1_sisg_aplicacion.sql
docker exec -i sisg-mysql mysql -uroot -psisg_dev --default-character-set=utf8mb4 < 2_sisg_almacen_datos.sql
```

## Opción B: con un MySQL 8 ya instalado

```bash
mysql -uroot -p --default-character-set=utf8mb4 < 1_sisg_aplicacion.sql
mysql -uroot -p --default-character-set=utf8mb4 < 2_sisg_almacen_datos.sql
```

## Abrirlo en DBeaver

Conexión nueva, tipo MySQL: `localhost`, puerto `3306`, usuario `root`, la contraseña que usaron. Marquen *Show all databases*. Si sale *Public Key Retrieval is not allowed*: *Driver properties*, `allowPublicKeyRetrieval=true`.

Qué mostrar (diagramas, ETL, consultas): `docs/GUIA_PRESENTACION.md`, secciones 3 y 4.

## Comprobar que cargó

```sql
SELECT COUNT(*) FROM sisg.estudio;           -- 91
SELECT COUNT(*) FROM sisg_dw.fact_estudio;   -- 12507
SELECT * FROM sisg_dw.v_estudios_mes_categoria LIMIT 5;
```

Las 8 consultas del curso están en `dw/sql/06_consultas.sql` y la reconciliación en `dw/sql/07_reconciliacion.sql`.

## Si quieren la aplicación completa (API e interfaz)

El SQL solo trae las bases. Para entrar a la interfaz hace falta el proyecto: `git clone` del repositorio, `backend/` con su `.env` y `npm run start:dev`, y `nuevo-diseño/` con `npm run dev`. Pasos en `docs/GUIA_PRESENTACION.md`, sección 2b.
