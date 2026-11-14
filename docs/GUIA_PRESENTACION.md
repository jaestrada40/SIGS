# SISG · Guía para presentar la base de datos (Grupo 4)

Esta guía sirve para explicar el proyecto de principio a fin: por qué hay dos bases, qué mostrar en cada una y cómo contestar las preguntas del docente.

## 1. Por qué hay dos bases (la aplicación y el almacén, las dos en MySQL)

**Explicado simple:** la base de la aplicación es la tienda y el almacén es el cuaderno de cuentas del dueño. Las dos son MySQL 8, en contenedores distintos.

| | **Aplicación (MySQL)** | **Almacén (MySQL)** |
|---|---|---|
| Qué es | Base de la **aplicación** (OLTP) | **Almacén de datos** para análisis (DW) |
| Para qué sirve | Registrar el día a día: pacientes, estudios, campañas, usuarios | Responder preguntas de negocio: cuánto, dónde, cuándo |
| Cómo se guarda | Cada dato una sola vez, rápido para escribir | Datos ordenados en estrella, rápido para consultar |
| Quién lo usa | La API (NestJS) y la interfaz web | El analista, con consultas y vistas |
| Dónde está | Docker `backend-db-1`, puerto **3306**, base `sisg` | Docker `dw-mysql-1`, puerto **3307**, bases `sisg_fuente` y `sisg_dw` |

**Por qué no una sola:**
1. Una base transaccional y una analítica tienen formas distintas (normalizada contra estrella): no se mezclan en el mismo esquema.
2. El curso pide un almacén aparte: ER de la fuente, estrella, ETL y consultas. Un ETL necesita origen y destino.
3. Las consultas analíticas pesadas no deben competir con quien registra pacientes.
4. MySQL fue la decisión del grupo (24 de octubre, definitiva).

**Cómo se conectan:** el puente (`dw/run_app.sh`) exporta las tablas de la aplicación a CSV, las carga en MySQL y corre el ETL. Al final hay una reconciliación que da diferencia 0.

## 2. Conexiones en DBeaver

| | Almacén (lo principal del curso) | Aplicación |
|---|---|---|
| Driver | MySQL | MySQL |
| Host / puerto | `localhost` / **3307** | `localhost` / **3306** |
| Usuario | `root` | `sisg` |
| Contraseña | `sisg_dev` | `DB_PASS` de `backend/.env` |
| Base | vacía, con *Show all databases* marcado | `sisg` |

Si MySQL da *Public Key Retrieval is not allowed*: *Driver properties*, `allowPublicKeyRetrieval=true`.

## 3. Qué mostrar en MySQL (lo que pide el curso)

### 3.1 ER de las fuentes: base `sisg_fuente`
Diagrama con 10 tablas y 13 llaves foráneas.
- Tablas: `entidad`, `tipo_entidad`, `paciente`, `estudio`, `tipo_estudio`, `campana`, `area_campana`, `departamento`, `municipio`, `bitacora`.
- Cómo: `sisg_fuente` → *Tables* → clic derecho → *View Diagram*.
- Decir: "Un estudio pertenece a un paciente y a un centro; un paciente vive en un municipio, que pertenece a un departamento. Las llaves foráneas garantizan que no haya estudios sin paciente."

### 3.2 Modelo estrella: base `sisg_dw`
Es una **constelación de hechos**: dos estrellas que comparten dimensiones.

| Estrella | Hecho (grano) | Dimensiones |
|---|---|---|
| 1. Estudios | `fact_estudio` (un estudio diagnóstico) | `dim_tiempo`, `dim_entidad`, `dim_geografia`, `dim_paciente`, `dim_tipo_estudio`, `dim_grupo_etario` |
| 2. Campañas | `fact_campana` (una campaña de salud) | `dim_tiempo` (inicio y fin), `dim_entidad`, `dim_geografia`, `dim_area_campana` |

Las dimensiones **conformadas** (compartidas por las dos estrellas) son `dim_tiempo`, `dim_geografia` y `dim_entidad`. Por eso se pueden cruzar estudios y campañas (consulta 6).

**Por qué dos hechos y no uno:** un estudio y una campaña son procesos distintos con granos distintos. Mezclarlos en una tabla sería incorrecto.

### 3.3 Cómo mostrar cada estrella por separado en DBeaver
1. En el navegador abre `sisg_dw` → *Tables*.
2. **Estrella 1:** mantén `Cmd` y haz clic en estas 7 tablas: `fact_estudio`, `dim_tiempo`, `dim_entidad`, `dim_geografia`, `dim_paciente`, `dim_tipo_estudio`, `dim_grupo_etario`. Clic derecho → *View Diagram*.
3. **Estrella 2:** repite con `fact_campana`, `dim_tiempo`, `dim_entidad`, `dim_geografia`, `dim_area_campana`.
4. **Completo:** selecciona todas las `fact_*` y `dim_*` (sin `etl_log`) y *View Diagram*.
5. En cada diagrama arrastra el hecho al centro y las dimensiones alrededor. Si el diagrama sale desordenado, usa el botón de *Layout* o aleja el zoom.
6. Guarda cada diagrama (`Cmd+S`) para tenerlos listos en la carpeta *Diagrams*.

### 3.4 ETL
- Procedimientos en `sisg_dw`: `sp_etl_completo` (el principal), `sp_etl_dimensiones`, `sp_etl_facts`, `sp_etl_resumen`, `sp_cargar_dim_tiempo`.
- Mostrar el resultado: `SELECT * FROM etl_log ORDER BY id DESC LIMIT 1;` (filas cargadas y estado OK).
- Decir: **E**xtrae de `sisg_fuente`, **T**ransforma (limpia, calcula edad, grupo etario, claves sustitutas) y **L**carga el estrella.

### 3.5 Consultas y vistas
- Las 8 consultas están en `dw/sql/06_consultas.sql` (ejecutar con `Alt+X`).
- Las 8 vistas `v_*` están en `sisg_dw` → *Views*. Ejemplo: `SELECT * FROM v_estudios_mes_categoria;`.
- La consulta 8 usa `fact_estudio_mensual` (tabla de sumarización): misma pregunta que la 1 con menos filas. Comparar con `EXPLAIN` (consulta 9).

### 3.6 Reglas, seguridad y calidad
- **Triggers** en `sisg_fuente`: validan estudios y campañas (`trg_estudio_valida`, `trg_campana_valida`) y llenan la bitácora de auditoría.
- **Rol `analista`:** solo lectura sobre `sisg_dw` (mínimo privilegio).
- **Reconciliación:** `dw/sql/07_reconciliacion.sql` debe dar diferencia 0 entre fuente y almacén.

## 4. Qué mostrar en la base de la aplicación

Conexión `sisg` → base `sisg` → *Tables*. Hay 9 tablas.

1. **Diagrama ER:** clic derecho en *Tables* → *View Diagram*. Ahora tiene **15 llaves foráneas**.
2. **Tablas:** `entidad`, `usuario`, `paciente`, `estudio`, `campana`, `atencion`, `referido`, `enlace_resultado`, `bitacora`.
3. **Relaciones principales:**
   - `entidad` es la raíz: casi todas las tablas llevan `entidad_id` (cada centro u organismo ve solo lo suyo).
   - `estudio` → `paciente`
   - `atencion` → `campana` y `paciente`
   - `referido` → `entidad` (origen y destino), `campana` y `estudio`
   - `enlace_resultado` → `estudio`
4. **Seguridad en la app:** `usuario` guarda solo hashes de contraseña y el secreto MFA cifrado. `bitacora` es la auditoría.
5. **Datos:** haz `SELECT * FROM entidad;` para mostrar que hay datos reales.

Si preguntan por qué esta base no es estrella: "Es transaccional. Está normalizada para escribir sin duplicar datos. La estrella está en el almacén."

## 5. Preguntas probables y respuestas cortas

| Pregunta | Respuesta |
|---|---|
| ¿Qué modelo usaron? | Estrella, en su variante de constelación: dos hechos con dimensiones conformadas. |
| ¿Por qué no una sola estrella? | Son dos procesos con granos distintos: estudios y campañas. |
| ¿Estrella o copo de nieve? | Estrella: las dimensiones son tablas planas, sin subdimensiones. |
| ¿Por qué dos bases? | Una es la aplicación (transaccional) y otra es el almacén. El curso pide el almacén aparte; las dos son MySQL, que el grupo eligió. |
| ¿Cómo llegan los datos al almacén? | Con el ETL: extrae de la fuente, transforma y carga el estrella. |
| ¿Cómo saben que cargó bien? | La reconciliación compara filas y montos entre fuente y almacén: diferencia 0. |
| ¿Qué es una dimensión conformada? | Una dimensión compartida con la misma estructura por varios hechos (`dim_tiempo`, `dim_geografia`, `dim_entidad`). |
| ¿Para qué la tabla de sumarización? | Para consultas más rápidas: viene ya agrupada por mes. |
| ¿Hay vistas? | Sí, ocho: una por cada consulta analítica. |
| ¿Y la seguridad? | Rol `analista` de solo lectura, MFA obligatorio, bitácora de auditoría y llaves foráneas. |

## 6. Antes de presentar (lista rápida)

- [ ] Docker corriendo: `docker ps` debe mostrar `backend-db-1` y `dw-mysql-1`.
- [ ] Si falta el almacén: `cd dw && ./run.sh`.
- [ ] Diagramas guardados: estrella 1, estrella 2, completo y ER de la fuente.
- [ ] Probar una vista y `etl_log` en MySQL.
- [ ] Probar el diagrama de la base de la aplicación.
