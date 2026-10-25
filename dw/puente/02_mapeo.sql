-- Puente app -> fuente, paso 2: limpieza y mapeo a los catálogos de sisg_fuente.
-- Se conservan los ids de la app para poder rastrear cada fila. Lo que la app no captura se declara abajo.
USE sisg_fuente;

-- Entidades. Tipo de la app -> catálogo; departamento por nombre (sin distinguir mayúsculas ni tildes).
INSERT INTO entidad (id, nombre, tipo_entidad_id, departamento_id, telefono, correo)
SELECT s.id, s.nombre, IF(s.tipo = 'CENTRO_DIAGNOSTICO', 1, 2), d.id, s.telefono, s.correo
FROM sisg_stg.stg_entidad s LEFT JOIN departamento d ON d.nombre = s.departamento;

-- Pacientes. Municipio solo si existe en el catálogo (y coincide con el departamento si viene).
INSERT INTO paciente (id, entidad_id, nombre_completo, dpi, fecha_nacimiento, sexo, departamento_id, municipio_id, telefono, estado)
SELECT s.id, s.entidad_id, s.nombre_completo, s.dpi, s.fecha_nacimiento, s.sexo, dp.id,
       (SELECT m.id FROM municipio m JOIN departamento d ON d.id = m.departamento_id
         WHERE m.nombre = s.municipio AND (s.departamento IS NULL OR d.nombre = s.departamento) LIMIT 1),
       s.telefono, IF(UPPER(COALESCE(s.estado, '')) IN ('INACTIVO', 'BAJA'), 'INACTIVO', 'ACTIVO')
FROM sisg_stg.stg_paciente s LEFT JOIN departamento dp ON dp.nombre = s.departamento;

-- Si solo vino el municipio, el departamento se deduce de él.
UPDATE paciente p JOIN municipio m ON m.id = p.municipio_id SET p.departamento_id = m.departamento_id WHERE p.departamento_id IS NULL;

-- Tipos de estudio que la app permite escribir libremente y no están en el catálogo: se agregan sin clasificar.
INSERT INTO tipo_estudio (nombre, categoria, precio_base_q, duracion_base)
SELECT DISTINCT s.tipo_estudio, 'Sin clasificar', 0, 0
FROM sisg_stg.stg_estudio s LEFT JOIN tipo_estudio t ON t.nombre = s.tipo_estudio
WHERE t.id IS NULL;

-- Estudios. Estado libre -> enumerado. La app NO registra costo ni duración: se usa el precio y la duración de
-- lista del catálogo (NULL si el tipo no está clasificado). Son valores de referencia, no montos reales cobrados.
INSERT INTO estudio (id, entidad_id, paciente_id, tipo_estudio_id, fecha, hora, especialista, sala_equipo, estado, duracion_min, costo_q, resultado)
SELECT s.id, s.entidad_id, s.paciente_id, t.id, s.fecha, s.hora, s.especialista, s.sala_equipo,
       CASE WHEN LOWER(s.estado) LIKE '%realiz%' THEN 'REALIZADO'
            WHEN LOWER(s.estado) LIKE '%cancel%' THEN 'CANCELADO' ELSE 'PROGRAMADO' END,
       NULLIF(t.duracion_base, 0), NULLIF(t.precio_base_q, 0), s.resultado
FROM sisg_stg.stg_estudio s JOIN tipo_estudio t ON t.nombre = s.tipo_estudio;

-- Campañas. Área de la app -> catálogo. Una fecha de fin anterior al inicio (la app no lo valida) se descarta.
-- La app no registra presupuesto: queda NULL.
INSERT INTO campana (id, entidad_id, area_id, nombre, departamento_id, municipio_id, ubicacion, fecha_inicio, fecha_fin, estado, personas_atendidas)
SELECT s.id, s.entidad_id,
       CASE s.area WHEN 'CARDIOVASCULAR' THEN 1 WHEN 'RESPIRATORIA' THEN 2 WHEN 'PLANIFICACION' THEN 3 ELSE 4 END,
       s.nombre, d.id, NULL, s.ubicacion, s.fecha_inicio,
       IF(s.fecha_fin < s.fecha_inicio, NULL, s.fecha_fin), s.estado, COALESCE(s.personas_atendidas, 0)
FROM sisg_stg.stg_campana s LEFT JOIN departamento d ON d.nombre = s.departamento;

-- Resumen de la carga: lo exportado frente a lo cargado y los datos que no se pudieron enlazar.
SELECT 'entidad' AS tabla, (SELECT COUNT(*) FROM sisg_stg.stg_entidad) AS exportadas, (SELECT COUNT(*) FROM entidad) AS cargadas,
       (SELECT COUNT(*) FROM entidad WHERE departamento_id IS NULL) AS sin_enlazar
UNION ALL SELECT 'paciente', (SELECT COUNT(*) FROM sisg_stg.stg_paciente), (SELECT COUNT(*) FROM paciente),
       (SELECT COUNT(*) FROM paciente WHERE departamento_id IS NULL)
UNION ALL SELECT 'estudio', (SELECT COUNT(*) FROM sisg_stg.stg_estudio), (SELECT COUNT(*) FROM estudio),
       (SELECT COUNT(*) FROM estudio e JOIN tipo_estudio t ON t.id = e.tipo_estudio_id WHERE t.categoria = 'Sin clasificar')
UNION ALL SELECT 'campana', (SELECT COUNT(*) FROM sisg_stg.stg_campana), (SELECT COUNT(*) FROM campana),
       (SELECT COUNT(*) FROM campana WHERE departamento_id IS NULL);
