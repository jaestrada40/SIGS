-- Vistas analíticas sobre el modelo estrella: una por cada consulta de 06_consultas.sql (1 a 8).
-- Se crean después de 04_dw_esquema.sql; el rol `analista` ya las puede leer (GRANT SELECT sobre sisg_dw.*).
-- Uso: SELECT * FROM v_estudios_mes_categoria;
USE sisg_dw;

-- 1. Estudios realizados e ingresos por mes y categoría.
CREATE OR REPLACE VIEW v_estudios_mes_categoria AS
SELECT t.anio, t.mes, te.categoria, COUNT(*) AS estudios, SUM(f.costo_q) AS ingresos_q
FROM fact_estudio f
JOIN dim_tiempo t ON t.tiempo_key = f.tiempo_key
JOIN dim_tipo_estudio te ON te.tipo_estudio_key = f.tipo_estudio_key
WHERE f.estado = 'REALIZADO'
GROUP BY t.anio, t.mes, te.categoria;

-- 2. Los 3 estudios más frecuentes de cada departamento.
CREATE OR REPLACE VIEW v_top3_estudios_departamento AS
SELECT departamento, tipo_estudio, estudios, posicion
FROM (
  SELECT g.departamento, te.tipo_estudio, COUNT(*) AS estudios,
         RANK() OVER (PARTITION BY g.departamento ORDER BY COUNT(*) DESC) AS posicion
  FROM fact_estudio f
  JOIN dim_geografia g ON g.geo_key = f.geo_key
  JOIN dim_tipo_estudio te ON te.tipo_estudio_key = f.tipo_estudio_key
  WHERE f.estado = 'REALIZADO'
  GROUP BY g.departamento, te.tipo_estudio
) r
WHERE posicion <= 3;

-- 3. Ingresos por centro y trimestre con acumulado del año.
CREATE OR REPLACE VIEW v_ingresos_centro_trimestre AS
SELECT e.nombre AS centro, t.anio, t.trimestre, SUM(f.costo_q) AS ingresos_q,
       SUM(SUM(f.costo_q)) OVER (PARTITION BY e.nombre, t.anio ORDER BY t.trimestre) AS acumulado_anio
FROM fact_estudio f
JOIN dim_entidad e ON e.entidad_key = f.entidad_key
JOIN dim_tiempo t ON t.tiempo_key = f.tiempo_key
WHERE f.estado = 'REALIZADO'
GROUP BY e.nombre, t.anio, t.trimestre;

-- 4. Perfil de pacientes por categoría de estudio, sexo y grupo de edad.
CREATE OR REPLACE VIEW v_perfil_pacientes AS
SELECT te.categoria, p.sexo, ge.etiqueta AS grupo_etario, COUNT(*) AS estudios
FROM fact_estudio f
JOIN dim_tipo_estudio te ON te.tipo_estudio_key = f.tipo_estudio_key
JOIN dim_paciente p ON p.paciente_key = f.paciente_key
JOIN dim_grupo_etario ge ON ge.grupo_etario_key = f.grupo_etario_key
WHERE f.estado = 'REALIZADO'
GROUP BY te.categoria, p.sexo, ge.etiqueta;

-- 5. Campañas: personas atendidas y costo por persona por área.
CREATE OR REPLACE VIEW v_campanas_por_area AS
SELECT a.area, COUNT(*) AS campanas, SUM(c.personas_atendidas) AS personas,
       ROUND(SUM(c.presupuesto_q) / NULLIF(SUM(c.personas_atendidas), 0), 2) AS costo_por_persona_q
FROM fact_campana c
JOIN dim_area_campana a ON a.area_key = c.area_key
WHERE c.personas_atendidas > 0
GROUP BY a.area;

-- 6. Cruce de los dos hechos por la dimensión conformada dim_geografia.
CREATE OR REPLACE VIEW v_estudios_vs_campanas_departamento AS
SELECT g.departamento, COALESCE(e.estudios, 0) AS estudios, COALESCE(c.personas, 0) AS personas_en_campanas
FROM (SELECT DISTINCT departamento FROM dim_geografia WHERE geo_key <> -1) g
LEFT JOIN (SELECT g1.departamento, COUNT(*) AS estudios
           FROM fact_estudio f JOIN dim_geografia g1 ON g1.geo_key = f.geo_key
           WHERE f.estado = 'REALIZADO' GROUP BY g1.departamento) e ON e.departamento = g.departamento
LEFT JOIN (SELECT g2.departamento, SUM(fc.personas_atendidas) AS personas
           FROM fact_campana fc JOIN dim_geografia g2 ON g2.geo_key = fc.geo_key
           GROUP BY g2.departamento) c ON c.departamento = g.departamento;

-- 7. Crecimiento mensual de estudios realizados.
CREATE OR REPLACE VIEW v_crecimiento_mensual AS
SELECT anio, mes, estudios,
       LAG(estudios) OVER (ORDER BY anio, mes) AS mes_anterior,
       ROUND(100 * (estudios - LAG(estudios) OVER (ORDER BY anio, mes)) / LAG(estudios) OVER (ORDER BY anio, mes), 1) AS variacion_pct
FROM (SELECT anio, mes, SUM(total_estudios) AS estudios FROM fact_estudio_mensual GROUP BY anio, mes) m;

-- 8. Igual que la 1, desde la tabla de sumarización (sin unir con el hecho).
CREATE OR REPLACE VIEW v_estudios_mes_categoria_resumen AS
SELECT m.anio, m.mes, te.categoria, SUM(m.total_estudios) AS estudios, SUM(m.ingresos_q) AS ingresos_q
FROM fact_estudio_mensual m
JOIN dim_tipo_estudio te ON te.tipo_estudio_key = m.tipo_estudio_key
GROUP BY m.anio, m.mes, te.categoria;
