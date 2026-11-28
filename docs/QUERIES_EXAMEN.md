# SISG · Consultas que pueden pedir (BD II)

Dos bases: **`sisg_fuente`** (OLTP, 3FN: `paciente`, `estudio`, `entidad`, `campana`, catálogos) y **`sisg_dw`** (estrella: `fact_estudio`, `fact_campana`, `dim_*`). Temas vistos en el curso: JOINs, subconsultas, agregación, funciones de ventana (clase 6), EXPLAIN e índices y privilegios (clase 7), triggers (clase 2), dimensiones conformadas y sumarización (clase 9), estrella vs copo de nieve (clase 12).

Truco para contestar: primero di **qué tablas une y por qué llave**, después el filtro, después la agrupación.

---
## A. Sobre la fuente (`USE sisg_fuente;`) · JOINs

```sql
-- A1. Pacientes con su departamento y municipio (INNER JOIN). Solo los que tienen ubicación.
SELECT p.id, p.nombre_completo, d.nombre AS departamento, m.nombre AS municipio
FROM paciente p
JOIN departamento d ON d.id = p.departamento_id
JOIN municipio m   ON m.id = p.municipio_id;

-- A2. Todos los pacientes, tengan o no ubicación (LEFT JOIN).
SELECT p.nombre_completo, COALESCE(d.nombre,'Sin dato') AS departamento
FROM paciente p
LEFT JOIN departamento d ON d.id = p.departamento_id;

-- A3. Pacientes SIN ningún estudio (LEFT JOIN + IS NULL, anti-join).
SELECT p.id, p.nombre_completo
FROM paciente p
LEFT JOIN estudio e ON e.paciente_id = p.id
WHERE e.id IS NULL;

-- A4. Lo mismo con NOT EXISTS (suele ser la respuesta "elegante").
SELECT p.id, p.nombre_completo
FROM paciente p
WHERE NOT EXISTS (SELECT 1 FROM estudio e WHERE e.paciente_id = p.id);

-- A5. Pacientes con sus estudios, tipo y centro (4 tablas).
SELECT p.nombre_completo, te.nombre AS estudio, e.fecha, e.estado, en.nombre AS centro
FROM estudio e
JOIN paciente p      ON p.id  = e.paciente_id
JOIN tipo_estudio te ON te.id = e.tipo_estudio_id
JOIN entidad en      ON en.id = e.entidad_id
ORDER BY e.fecha DESC;

-- A6. Pacientes con estudio realizado de una categoría (ej. Imagenología).
SELECT DISTINCT p.nombre_completo
FROM paciente p
JOIN estudio e       ON e.paciente_id = p.id
JOIN tipo_estudio te ON te.id = e.tipo_estudio_id
WHERE e.estado = 'REALIZADO' AND te.categoria = 'Imagenología';

-- A7. Centros sin estudios y departamentos sin entidades (RIGHT JOIN equivalente a LEFT invertido).
SELECT d.nombre AS departamento, COUNT(en.id) AS entidades
FROM entidad en
RIGHT JOIN departamento d ON d.id = en.departamento_id
GROUP BY d.nombre
ORDER BY entidades DESC;

-- A8. FULL OUTER JOIN (MySQL no lo tiene: LEFT UNION RIGHT).
SELECT d.nombre AS departamento, en.nombre AS entidad
FROM departamento d LEFT JOIN entidad en ON en.departamento_id = d.id
UNION
SELECT d.nombre, en.nombre
FROM departamento d RIGHT JOIN entidad en ON en.departamento_id = d.id;

-- A9. CROSS JOIN: todas las combinaciones departamento x área de campaña.
SELECT d.nombre AS departamento, a.nombre AS area
FROM departamento d CROSS JOIN area_campana a;

-- A10. Self join: pares de pacientes distintos de la misma entidad y mismo municipio.
SELECT a.nombre_completo AS paciente_1, b.nombre_completo AS paciente_2, m.nombre AS municipio
FROM paciente a
JOIN paciente b  ON b.municipio_id = a.municipio_id AND b.entidad_id = a.entidad_id AND a.id < b.id
JOIN municipio m ON m.id = a.municipio_id;

-- A11. Campañas con organismo, área y lugar.
SELECT c.nombre, en.nombre AS organismo, a.nombre AS area, d.nombre AS departamento,
       c.fecha_inicio, c.estado, c.personas_atendidas
FROM campana c
JOIN entidad en     ON en.id = c.entidad_id
JOIN area_campana a ON a.id  = c.area_id
LEFT JOIN departamento d ON d.id = c.departamento_id;
```

## B. Agregación, HAVING, CASE, fechas

```sql
-- B1. Pacientes por sexo.
SELECT sexo, COUNT(*) AS pacientes FROM paciente GROUP BY sexo;

-- B2. Pacientes por departamento, solo los que tienen más de 10 (HAVING filtra grupos; WHERE filtra filas).
SELECT d.nombre, COUNT(*) AS pacientes
FROM paciente p JOIN departamento d ON d.id = p.departamento_id
GROUP BY d.nombre
HAVING COUNT(*) > 10
ORDER BY pacientes DESC;

-- B3. Estudios por estado e ingresos de los realizados.
SELECT estado, COUNT(*) AS estudios, SUM(costo_q) AS ingresos_q, AVG(duracion_min) AS duracion_prom
FROM estudio GROUP BY estado;

-- B4. Ingresos por centro y tipo de estudio.
SELECT en.nombre AS centro, te.nombre AS estudio, COUNT(*) AS estudios, SUM(e.costo_q) AS ingresos_q
FROM estudio e
JOIN entidad en      ON en.id = e.entidad_id
JOIN tipo_estudio te ON te.id = e.tipo_estudio_id
WHERE e.estado = 'REALIZADO'
GROUP BY en.nombre, te.nombre
ORDER BY ingresos_q DESC;

-- B5. Estudios por mes (funciones de fecha).
SELECT YEAR(fecha) AS anio, MONTH(fecha) AS mes, COUNT(*) AS estudios
FROM estudio GROUP BY YEAR(fecha), MONTH(fecha) ORDER BY anio, mes;

-- B6. Edad y grupo etario de cada paciente con CASE.
SELECT nombre_completo,
       TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad,
       CASE WHEN TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) < 15 THEN '0-14'
            WHEN TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) < 30 THEN '15-29'
            WHEN TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) < 45 THEN '30-44'
            WHEN TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) < 60 THEN '45-59'
            ELSE '60+' END AS grupo
FROM paciente WHERE fecha_nacimiento IS NOT NULL;

-- B7. Pacientes con más de 3 estudios realizados.
SELECT p.nombre_completo, COUNT(*) AS estudios
FROM paciente p JOIN estudio e ON e.paciente_id = p.id
WHERE e.estado = 'REALIZADO'
GROUP BY p.id, p.nombre_completo
HAVING COUNT(*) > 3;

-- B8. Presupuesto y personas atendidas por área, con costo por persona.
SELECT a.nombre AS area, SUM(c.personas_atendidas) AS personas, SUM(c.presupuesto_q) AS presupuesto,
       ROUND(SUM(c.presupuesto_q)/NULLIF(SUM(c.personas_atendidas),0),2) AS q_por_persona
FROM campana c JOIN area_campana a ON a.id = c.area_id
GROUP BY a.nombre;

-- B9. Búsqueda y filtros: LIKE, IN, BETWEEN.
SELECT * FROM paciente WHERE nombre_completo LIKE 'María%';
SELECT * FROM estudio WHERE estado IN ('REALIZADO','PROGRAMADO') AND fecha BETWEEN '2026-01-01' AND '2026-06-30';
```

## C. Subconsultas y CTE

```sql
-- C1. Estudios con costo mayor al promedio (subconsulta escalar).
SELECT id, costo_q FROM estudio
WHERE costo_q > (SELECT AVG(costo_q) FROM estudio WHERE estado = 'REALIZADO');

-- C2. Pacientes que tuvieron algún estudio cancelado (IN / EXISTS).
SELECT nombre_completo FROM paciente
WHERE id IN (SELECT paciente_id FROM estudio WHERE estado = 'CANCELADO');

-- C3. Departamento con más pacientes (subconsulta en HAVING).
SELECT d.nombre, COUNT(*) AS n
FROM paciente p JOIN departamento d ON d.id = p.departamento_id
GROUP BY d.nombre
HAVING COUNT(*) = (SELECT MAX(c) FROM (SELECT COUNT(*) c FROM paciente GROUP BY departamento_id) t);

-- C4. CTE: centros por encima del promedio de ingresos.
WITH ing AS (
  SELECT entidad_id, SUM(costo_q) AS total FROM estudio WHERE estado='REALIZADO' GROUP BY entidad_id
)
SELECT en.nombre, i.total
FROM ing i JOIN entidad en ON en.id = i.entidad_id
WHERE i.total > (SELECT AVG(total) FROM ing);

-- C5. Subconsulta correlacionada: último estudio de cada paciente.
SELECT p.nombre_completo, e.fecha, e.estado
FROM paciente p JOIN estudio e ON e.paciente_id = p.id
WHERE e.fecha = (SELECT MAX(e2.fecha) FROM estudio e2 WHERE e2.paciente_id = p.id);
```

## D. Funciones de ventana (clase 6)

```sql
-- D1. Ranking de centros por ingresos (RANK, DENSE_RANK, ROW_NUMBER: diferencia en empates).
SELECT en.nombre, SUM(e.costo_q) AS ingresos,
       RANK()       OVER (ORDER BY SUM(e.costo_q) DESC) AS rank_,
       DENSE_RANK() OVER (ORDER BY SUM(e.costo_q) DESC) AS dense_,
       ROW_NUMBER() OVER (ORDER BY SUM(e.costo_q) DESC) AS fila
FROM estudio e JOIN entidad en ON en.id = e.entidad_id
WHERE e.estado='REALIZADO' GROUP BY en.nombre;

-- D2. Top 3 por grupo (PARTITION BY): los 3 estudios más frecuentes de cada departamento -> es la consulta 2 del DW (sección F).

-- D3. Acumulado y promedio móvil de ingresos por mes.
SELECT mes, ingresos,
       SUM(ingresos) OVER (ORDER BY mes) AS acumulado,
       AVG(ingresos) OVER (ORDER BY mes ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS prom_movil_3m
FROM (SELECT DATE_FORMAT(fecha,'%Y-%m') AS mes, SUM(costo_q) AS ingresos
      FROM estudio WHERE estado='REALIZADO' GROUP BY DATE_FORMAT(fecha,'%Y-%m')) m;

-- D4. LAG / LEAD: días entre estudios consecutivos de un mismo paciente.
SELECT paciente_id, fecha,
       LAG(fecha) OVER (PARTITION BY paciente_id ORDER BY fecha) AS anterior,
       DATEDIFF(fecha, LAG(fecha) OVER (PARTITION BY paciente_id ORDER BY fecha)) AS dias
FROM estudio;

-- D5. Porcentaje del total por categoría (SUM() OVER ()).
SELECT te.categoria, COUNT(*) AS estudios,
       ROUND(100*COUNT(*)/SUM(COUNT(*)) OVER (),1) AS pct
FROM estudio e JOIN tipo_estudio te ON te.id = e.tipo_estudio_id
GROUP BY te.categoria;

-- D6. NTILE: cuartiles de pacientes por número de estudios.
SELECT paciente_id, n, NTILE(4) OVER (ORDER BY n DESC) AS cuartil
FROM (SELECT paciente_id, COUNT(*) n FROM estudio GROUP BY paciente_id) t;
```

## E. DML, DDL, vistas, índices, transacciones, privilegios

```sql
-- E1. INSERT / UPDATE / DELETE (el trigger registra en bitacora).
INSERT INTO paciente (entidad_id, nombre_completo, sexo) VALUES (1, 'Ana Pérez', 'F');
UPDATE estudio SET estado = 'REALIZADO', costo_q = 150 WHERE id = 1;
DELETE FROM estudio WHERE id = 999 AND estado = 'CANCELADO';

-- E2. Vista.
CREATE OR REPLACE VIEW v_pacientes_ubicacion AS
SELECT p.id, p.nombre_completo, d.nombre AS departamento, m.nombre AS municipio
FROM paciente p
LEFT JOIN departamento d ON d.id = p.departamento_id
LEFT JOIN municipio m   ON m.id = p.municipio_id;

-- E3. Índice y plan de ejecución (clase 7): mostrar que el índice se usa (type=ref, key=ix_estudio_paciente).
EXPLAIN SELECT * FROM estudio WHERE paciente_id = 10;
CREATE INDEX ix_estudio_fecha ON estudio (fecha);
SHOW INDEX FROM estudio;

-- E4. Transacción.
START TRANSACTION;
  UPDATE estudio SET estado='CANCELADO' WHERE id = 5;
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_db) VALUES ('estudio',5,'UPDATE',CURRENT_USER());
ROLLBACK;   -- o COMMIT

-- E5. Privilegios (mínimo privilegio).
CREATE USER 'lector'@'%' IDENTIFIED BY 'cambiar';
GRANT SELECT ON sisg_fuente.* TO 'lector'@'%';
SHOW GRANTS FOR 'lector'@'%';
GRANT analista TO 'lector'@'%';   -- rol de solo lectura del DW

-- E6. Triggers: ver y probar (clase 2).
SHOW TRIGGERS FROM sisg_fuente;
SELECT * FROM bitacora ORDER BY id DESC LIMIT 10;

-- E7. Procedimiento almacenado simple: estudios de un paciente.
DELIMITER //
CREATE PROCEDURE sp_estudios_paciente(IN p_id INT)
BEGIN
  SELECT e.fecha, te.nombre, e.estado, e.costo_q
  FROM estudio e JOIN tipo_estudio te ON te.id = e.tipo_estudio_id
  WHERE e.paciente_id = p_id ORDER BY e.fecha;
END//
DELIMITER ;
CALL sp_estudios_paciente(1);
```

## F. Sobre el almacén (`USE sisg_dw;`) · estrella

Ya están en `dw/sql/06_consultas.sql` (y como vistas `v_*` en `04b_dw_vistas.sql`). Cuál responde qué:

| # | Pregunta | Técnica |
|---|---|---|
| 1 | Estudios e ingresos por mes y categoría | hecho + 2 dimensiones, GROUP BY |
| 2 | Top 3 estudios por departamento | `RANK() OVER (PARTITION BY ...)` |
| 3 | Ingresos por centro y trimestre con acumulado | `SUM() OVER` |
| 4 | Perfil por categoría, sexo y grupo etario | hecho + 3 dimensiones |
| 5 | Campañas: personas y costo por persona por área | `NULLIF`, sin dividir entre 0 |
| 6 | Estudios vs personas en campañas por departamento | dimensión **conformada** (`dim_geografia`) |
| 7 | Crecimiento mensual | `LAG` |
| 8 | Igual que la 1 con la tabla de sumarización | `fact_estudio_mensual` |
| 9 | Comparar planes | `EXPLAIN` 1 vs 8 |

Variantes que pueden pedir (misma forma que arriba):

```sql
-- F1. Ingresos por departamento del paciente y año.
SELECT g.departamento, t.anio, SUM(f.costo_q) AS ingresos_q
FROM fact_estudio f
JOIN dim_geografia g ON g.geo_key = f.geo_key
JOIN dim_tiempo t    ON t.tiempo_key = f.tiempo_key
WHERE f.estado = 'REALIZADO'
GROUP BY g.departamento, t.anio ORDER BY t.anio, ingresos_q DESC;

-- F2. Estudios en fin de semana vs entre semana.
SELECT t.es_fin_semana, COUNT(*) AS estudios
FROM fact_estudio f JOIN dim_tiempo t ON t.tiempo_key = f.tiempo_key
WHERE f.estado='REALIZADO' GROUP BY t.es_fin_semana;

-- F3. Duración promedio por tipo de estudio (medida que se promedia, no se suma).
SELECT te.tipo_estudio, ROUND(AVG(f.duracion_min),1) AS min_prom
FROM fact_estudio f JOIN dim_tipo_estudio te ON te.tipo_estudio_key = f.tipo_estudio_key
WHERE f.estado='REALIZADO' GROUP BY te.tipo_estudio ORDER BY min_prom DESC;

-- F4. Campañas con la dimensión tiempo en sus dos roles (inicio y fin).
SELECT c.campana_id, ti.fecha AS inicio, tf.fecha AS fin, c.duracion_dias
FROM fact_campana c
JOIN dim_tiempo ti ON ti.tiempo_key = c.tiempo_inicio_key
LEFT JOIN dim_tiempo tf ON tf.tiempo_key = c.tiempo_fin_key;

-- F5. Tipo de entidad (centros vs organismos) y estudios/campañas de cada una (drill-across, dos hechos).
SELECT e.tipo_entidad, COALESCE(x.estudios,0) AS estudios, COALESCE(c.campanas,0) AS campanas
FROM (SELECT DISTINCT tipo_entidad FROM dim_entidad) e
LEFT JOIN (SELECT de.tipo_entidad, COUNT(*) AS estudios
           FROM fact_estudio f JOIN dim_entidad de ON de.entidad_key=f.entidad_key GROUP BY de.tipo_entidad) x
       ON x.tipo_entidad = e.tipo_entidad
LEFT JOIN (SELECT de.tipo_entidad, COUNT(*) AS campanas
           FROM fact_campana f JOIN dim_entidad de ON de.entidad_key=f.entidad_key GROUP BY de.tipo_entidad) c
       ON c.tipo_entidad = e.tipo_entidad;

-- F6. ROLLUP: subtotales por año y mes.
SELECT t.anio, t.mes, SUM(f.costo_q) AS ingresos_q
FROM fact_estudio f JOIN dim_tiempo t ON t.tiempo_key = f.tiempo_key
WHERE f.estado='REALIZADO' GROUP BY t.anio, t.mes WITH ROLLUP;

-- F7. Bitácora ETL y conteos de control.
SELECT * FROM etl_log ORDER BY id DESC LIMIT 5;
SELECT 'fact_estudio', COUNT(*) FROM fact_estudio UNION ALL SELECT 'fact_campana', COUNT(*) FROM fact_campana;

-- F8. Ejecutar la carga completa (ETL).
CALL sp_etl_completo();
```

## G. Preguntas de teoría que acompañan a las consultas

- **WHERE vs HAVING:** WHERE filtra filas antes de agrupar; HAVING filtra grupos después.
- **INNER vs LEFT:** INNER solo coincidencias; LEFT conserva todo lo de la izquierda (con NULL si no hay pareja).
- **RANK vs DENSE_RANK vs ROW_NUMBER:** con empates RANK salta números, DENSE_RANK no, ROW_NUMBER nunca repite.
- **Por qué `NULLIF`:** evita dividir entre cero.
- **Por qué se filtra `estado = 'REALIZADO'`:** un estudio programado o cancelado no es ingreso.
- **Por qué la tabla de sumarización:** menos filas, la misma respuesta; se compara con EXPLAIN.
- **Por qué `dim_geografia` es conformada:** misma estructura y llaves en los dos hechos, permite cruzarlos.
- **Por qué el DW no guarda nombre ni DPI:** son datos de salud; solo sexo y edad en grupos.
- **Estrella vs copo de nieve:** estrella, por menos uniones y jerarquías de 2 niveles.

> Las consultas de las secciones A a E son nuevas y no se corrieron contra la base (ajusta nombres de catálogo como `'Imagenología'` a los datos reales). Las de la sección F se basan en `06_consultas.sql`, que sí es la entregada.
