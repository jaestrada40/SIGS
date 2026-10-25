-- Datos sintéticos (nada es real). Catálogos fijos + pacientes, estudios y campañas aleatorios.
USE sisg_fuente;
SET SESSION cte_max_recursion_depth = 100000;

-- ids 1-8 centros de diagnóstico, ids 9-14 organismos no lucrativos (la campaña de abajo depende de esto)
INSERT INTO entidad (nombre, tipo_entidad_id, departamento_id, telefono, correo) VALUES
 ('Centro Diagnóstico El Roble',1,1,'+502 2412-3001','contacto@elroble.example.gt'),
 ('Imagenología Zona 10',1,1,'+502 2412-3002','info@imagenologia10.example.gt'),
 ('Laboratorio Clínico Central',1,1,'+502 2412-3003','info@labcentral.example.gt'),
 ('Rayos X Occidente',1,9,'+502 7761-4004','info@rxoccidente.example.gt'),
 ('Diagnóstico del Norte',1,16,'+502 7951-5005','info@dxnorte.example.gt'),
 ('Centro de Imágenes Antigua',1,3,'+502 7832-6006','info@imagenesantigua.example.gt'),
 ('Laboratorio Costa Sur',1,5,'+502 7888-7007','info@labcostasur.example.gt'),
 ('Clínica de Diagnóstico Oriente',1,20,'+502 7942-8008','info@dxoriente.example.gt'),
 ('Liga Guatemalteca del Corazón',2,1,'+502 2412-9001','info@ligacorazon.example.gt'),
 ('Liga Nacional contra el Cáncer',2,1,'+502 2412-9002','info@ligacancer.example.gt'),
 ('Liga Guatemalteca del Pulmón',2,1,'+502 2412-9003','info@ligapulmon.example.gt'),
 ('APROFAM',2,1,'+502 2412-9004','info@aprofam.example.gt'),
 ('INCAN',2,1,'+502 2412-9005','info@incan.example.gt'),
 ('Fundación Salud Rural',2,13,'+502 7764-9006','info@saludrural.example.gt');

-- Números 1..6000 para generar filas.
CREATE TEMPORARY TABLE tmp_n AS
  WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 6000)
  SELECT i FROM n;

-- 6000 pacientes repartidos al azar entre las 14 entidades.
INSERT INTO paciente (entidad_id, nombre_completo, dpi, fecha_nacimiento, sexo, municipio_id, telefono, estado)
SELECT 1 + FLOOR(RAND() * 14),
       CONCAT(ELT(1+FLOOR(RAND()*12),'María','José','Ana','Luis','Carmen','Juan','Rosa','Carlos','Sofía','Pedro','Lucía','Miguel'), ' ',
              ELT(1+FLOOR(RAND()*12),'López','García','Pérez','Hernández','Morales','Ramírez','Castillo','Gómez','Cruz','Tzul','Choc','Mendoza'), ' ',
              ELT(1+FLOOR(RAND()*12),'López','García','Pérez','Hernández','Morales','Ramírez','Castillo','Gómez','Cruz','Tzul','Choc','Mendoza')),
       LPAD(2000000000000 + i * 7919, 13, '0'),
       DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 29200) DAY),
       IF(RAND() < 0.02, 'NE', ELT(1 + FLOOR(RAND() * 2), 'F', 'M')),
       1 + FLOOR(RAND() * 32),
       CONCAT('+502 ', 2000 + FLOOR(RAND() * 7999), '-', 1000 + FLOOR(RAND() * 8999)),
       IF(RAND() < 0.95, 'ACTIVO', 'INACTIVO')
FROM tmp_n;

UPDATE paciente p JOIN municipio m ON m.id = p.municipio_id SET p.departamento_id = m.departamento_id;

-- Estudios: solo pacientes de centros de diagnóstico, 0 a 6 estudios cada uno.
CREATE TEMPORARY TABLE tmp_est AS
SELECT p.id AS paciente_id, p.entidad_id, 1 + FLOOR(RAND() * 10) AS tipo_id,
       DATE_ADD('2025-01-01', INTERVAL FLOOR(RAND() * 660) DAY) AS fecha,
       RAND() AS r_estado, RAND() AS r_precio, RAND() AS r_dur, RAND() AS r_hora, RAND() AS r_esp
FROM paciente p
JOIN entidad e ON e.id = p.entidad_id AND e.tipo_entidad_id = 1
JOIN (SELECT i FROM tmp_n WHERE i <= 6) k
WHERE RAND() < 0.6;

INSERT INTO estudio (entidad_id, paciente_id, tipo_estudio_id, fecha, hora, especialista, sala_equipo, estado, duracion_min, costo_q)
SELECT t.entidad_id, t.paciente_id, t.tipo_id, t.fecha,
       SEC_TO_TIME(25200 + FLOOR(t.r_hora * 36000)),
       ELT(1 + FLOOR(t.r_esp * 6), 'Dr. Méndez','Dra. Solís','Dr. Barrios','Dra. Aguilar','Dr. Cifuentes','Dra. Paz'),
       CONCAT('Sala ', 1 + FLOOR(t.r_esp * 4)),
       IF(t.fecha > CURDATE(), 'PROGRAMADO', IF(t.r_estado < 0.92, 'REALIZADO', 'CANCELADO')),
       GREATEST(5, ROUND(te.duracion_base * (0.8 + 0.4 * t.r_dur))),
       ROUND(te.precio_base_q * (0.9 + 0.3 * t.r_precio), 2)
FROM tmp_est t
JOIN tipo_estudio te ON te.id = t.tipo_id;

-- 150 campañas de los organismos no lucrativos (ids 9 a 14).
CREATE TEMPORARY TABLE tmp_camp AS
SELECT i, 9 + FLOOR(RAND() * 6) AS entidad_id, 1 + FLOOR(RAND() * 4) AS area_id, 1 + FLOOR(RAND() * 22) AS dept,
       DATE_ADD('2025-01-01', INTERVAL FLOOR(RAND() * 640) DAY) AS inicio, 1 + FLOOR(RAND() * 14) AS dias,
       RAND() AS r_personas, RAND() AS r_presupuesto
FROM tmp_n WHERE i <= 150;

INSERT INTO campana (entidad_id, area_id, nombre, departamento_id, municipio_id, fecha_inicio, fecha_fin, estado, personas_atendidas, presupuesto_q)
SELECT t.entidad_id, t.area_id, CONCAT('Jornada ', a.nombre, ' #', t.i), t.dept,
       (SELECT m.id FROM municipio m WHERE m.departamento_id = t.dept ORDER BY RAND() LIMIT 1),
       t.inicio, DATE_ADD(t.inicio, INTERVAL t.dias - 1 DAY),
       IF(t.inicio > CURDATE(), 'PROGRAMADA', IF(DATE_ADD(t.inicio, INTERVAL t.dias - 1 DAY) < CURDATE(), 'FINALIZADA', 'EN_CURSO')),
       IF(t.inicio > CURDATE(), 0, FLOOR(30 + t.r_personas * 470)),
       ROUND(5000 + t.r_presupuesto * 45000, 2)
FROM tmp_camp t
JOIN area_campana a ON a.id = t.area_id;
