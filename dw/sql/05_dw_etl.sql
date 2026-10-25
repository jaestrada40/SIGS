-- ETL: sisg_fuente -> sisg_dw. Se ejecuta con CALL sp_etl_completo();
-- shortcut: recarga completa (borra y vuelve a cargar), sirve para el volumen del proyecto; para producción usar carga incremental con marca de agua en etl_log.
USE sisg_dw;
DELIMITER $$

CREATE PROCEDURE sp_cargar_dim_tiempo(IN p_desde DATE, IN p_hasta DATE)
BEGIN
  SET SESSION cte_max_recursion_depth = 20000;
  INSERT IGNORE INTO dim_tiempo (tiempo_key, fecha, anio, trimestre, mes, nombre_mes, dia, dia_semana, es_fin_semana)
  WITH RECURSIVE d AS (SELECT p_desde AS f UNION ALL SELECT f + INTERVAL 1 DAY FROM d WHERE f < p_hasta)
  SELECT YEAR(f) * 10000 + MONTH(f) * 100 + DAY(f), f, YEAR(f), QUARTER(f), MONTH(f),
         ELT(MONTH(f),'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'),
         DAY(f), ELT(WEEKDAY(f) + 1,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'), WEEKDAY(f) >= 5
  FROM d;
END$$

CREATE PROCEDURE sp_etl_dimensiones()
BEGIN
  SET FOREIGN_KEY_CHECKS = 0;
  TRUNCATE fact_estudio; TRUNCATE fact_campana; TRUNCATE fact_estudio_mensual;
  TRUNCATE dim_geografia; TRUNCATE dim_entidad; TRUNCATE dim_paciente; TRUNCATE dim_tipo_estudio; TRUNCATE dim_area_campana;
  SET FOREIGN_KEY_CHECKS = 1;

  -- geo_key -1 = desconocido; un renglón por municipio y uno por departamento (campañas sin municipio).
  INSERT INTO dim_geografia (geo_key, departamento_id, municipio_id, departamento, municipio) VALUES (-1, NULL, NULL, 'Desconocido', 'Desconocido');
  INSERT INTO dim_geografia (departamento_id, municipio_id, departamento, municipio)
    SELECT m.departamento_id, m.id, d.nombre, m.nombre
    FROM sisg_fuente.municipio m JOIN sisg_fuente.departamento d ON d.id = m.departamento_id;
  INSERT INTO dim_geografia (departamento_id, municipio_id, departamento, municipio)
    SELECT d.id, NULL, d.nombre, '(Sin municipio)' FROM sisg_fuente.departamento d;

  INSERT INTO dim_entidad (entidad_id, nombre, tipo_entidad, departamento)
    SELECT e.id, e.nombre, te.nombre, COALESCE(d.nombre, 'Desconocido')
    FROM sisg_fuente.entidad e
    JOIN sisg_fuente.tipo_entidad te ON te.id = e.tipo_entidad_id
    LEFT JOIN sisg_fuente.departamento d ON d.id = e.departamento_id;

  INSERT INTO dim_paciente (paciente_id, sexo) SELECT id, sexo FROM sisg_fuente.paciente;
  INSERT INTO dim_tipo_estudio (tipo_estudio_id, tipo_estudio, categoria) SELECT id, nombre, categoria FROM sisg_fuente.tipo_estudio;
  INSERT INTO dim_area_campana (area_id, area) SELECT id, nombre FROM sisg_fuente.area_campana;
END$$

CREATE PROCEDURE sp_etl_facts()
BEGIN
  INSERT INTO fact_estudio (estudio_id, tiempo_key, entidad_key, geo_key, paciente_key, tipo_estudio_key, grupo_etario_key, estado, cantidad, costo_q, duracion_min)
  SELECT s.id, YEAR(s.fecha) * 10000 + MONTH(s.fecha) * 100 + DAY(s.fecha), de.entidad_key,
         COALESCE(dg.geo_key, dd.geo_key, -1), dp.paciente_key, dt.tipo_estudio_key, COALESCE(ge.grupo_etario_key, -1),
         s.estado, 1, s.costo_q, s.duracion_min
  FROM sisg_fuente.estudio s
  JOIN sisg_fuente.paciente p ON p.id = s.paciente_id
  JOIN dim_entidad de ON de.entidad_id = s.entidad_id
  JOIN dim_paciente dp ON dp.paciente_id = s.paciente_id
  JOIN dim_tipo_estudio dt ON dt.tipo_estudio_id = s.tipo_estudio_id
  LEFT JOIN dim_geografia dg ON dg.municipio_id = p.municipio_id
  LEFT JOIN dim_geografia dd ON dd.departamento_id = p.departamento_id AND dd.municipio_id IS NULL
  LEFT JOIN dim_grupo_etario ge ON p.fecha_nacimiento IS NOT NULL
        AND TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, s.fecha) BETWEEN ge.edad_min AND ge.edad_max;

  INSERT INTO fact_campana (campana_id, tiempo_inicio_key, tiempo_fin_key, entidad_key, geo_key, area_key, estado, personas_atendidas, presupuesto_q, duracion_dias)
  SELECT c.id, YEAR(c.fecha_inicio) * 10000 + MONTH(c.fecha_inicio) * 100 + DAY(c.fecha_inicio),
         IF(c.fecha_fin IS NULL, NULL, YEAR(c.fecha_fin) * 10000 + MONTH(c.fecha_fin) * 100 + DAY(c.fecha_fin)),
         de.entidad_key, COALESCE(gm.geo_key, gd.geo_key, -1), da.area_key, c.estado, c.personas_atendidas, c.presupuesto_q,
         DATEDIFF(COALESCE(c.fecha_fin, c.fecha_inicio), c.fecha_inicio) + 1
  FROM sisg_fuente.campana c
  JOIN dim_entidad de ON de.entidad_id = c.entidad_id
  JOIN dim_area_campana da ON da.area_id = c.area_id
  LEFT JOIN dim_geografia gm ON gm.municipio_id = c.municipio_id
  LEFT JOIN dim_geografia gd ON gd.departamento_id = c.departamento_id AND gd.municipio_id IS NULL;
END$$

CREATE PROCEDURE sp_etl_resumen()
BEGIN
  INSERT INTO fact_estudio_mensual (anio, mes, entidad_key, tipo_estudio_key, total_estudios, ingresos_q, duracion_prom_min)
  SELECT t.anio, t.mes, f.entidad_key, f.tipo_estudio_key, COUNT(*), SUM(f.costo_q), AVG(f.duracion_min)
  FROM fact_estudio f JOIN dim_tiempo t ON t.tiempo_key = f.tiempo_key
  WHERE f.estado = 'REALIZADO'
  GROUP BY t.anio, t.mes, f.entidad_key, f.tipo_estudio_key;
END$$

CREATE PROCEDURE sp_etl_completo()
BEGIN
  DECLARE v_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 @msg = MESSAGE_TEXT;
    UPDATE etl_log SET fin = NOW(), resultado = 'ERROR', mensaje = @msg WHERE id = v_id;
    RESIGNAL;
  END;

  INSERT INTO etl_log (inicio, resultado) VALUES (NOW(), 'EN_CURSO');
  SET v_id = LAST_INSERT_ID();

  CALL sp_cargar_dim_tiempo('2024-01-01', '2027-12-31');
  CALL sp_etl_dimensiones();
  CALL sp_etl_facts();
  CALL sp_etl_resumen();

  UPDATE etl_log
     SET fin = NOW(), resultado = 'OK',
         filas_estudio = (SELECT COUNT(*) FROM fact_estudio),
         filas_campana = (SELECT COUNT(*) FROM fact_campana),
         filas_resumen = (SELECT COUNT(*) FROM fact_estudio_mensual)
   WHERE id = v_id;
END$$

DELIMITER ;
