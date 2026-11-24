-- Agregado mensual del Grupo 4 para la tabla buzón del Grupo 8: analitica.ingesta_g4_servicio.
-- Lee de nuestro almacén (sisg_dw) y produce las filas EXACTAS que se insertarían. NO inserta nada.
-- Columnas: sk_tiempo, sk_establecimiento, sk_geografia, sk_servicio, servicios, monto_cobrado.
-- Acuerdos con el Grupo 8 (21 nov. 2026):
--   * sk_tiempo = primer día del mes (yyyymm01).
--   * Geografía = ubicación de la sede (centros) o de la jornada (campañas).
--   * Cada persona atendida o estudio realizado cuenta como un servicio.
--   * monto_cobrado: precio de lista referencial en centros; 0.00 en organismos.
--   * sk_establecimiento: SUPUESTO = 10 + entidad_id (ellos darán de alta del 11 al 24 en el orden que enviemos). Confirmar.
--   * Campañas: sk_servicio = 19 (Atención en Jornada / Campaña Preventiva, confirmado por el Grupo 8).
USE sisg_dw;

-- Geografía de la sede de cada centro: código departamental genérico (nuestro dato solo llega a departamento).
-- Chiquimula (2000) y los demás departamentos sin código en el catálogo del Grupo 8 quedan en -1 hasta que lo agreguen.
SELECT t.anio * 10000 + t.mes * 100 + 1 AS sk_tiempo,
       10 + e.entidad_id AS sk_establecimiento,
       CASE e.departamento
         WHEN 'Guatemala' THEN 100 WHEN 'El Progreso' THEN 200 WHEN 'Sacatepéquez' THEN 300 WHEN 'Chimaltenango' THEN 400
         WHEN 'Santa Rosa' THEN 600 WHEN 'Sololá' THEN 700 WHEN 'Totonicapán' THEN 800 WHEN 'Suchitepéquez' THEN 1000
         WHEN 'Retalhuleu' THEN 1100 WHEN 'San Marcos' THEN 1200 WHEN 'Quiché' THEN 1400 WHEN 'Baja Verapaz' THEN 1500
         WHEN 'Izabal' THEN 1800 WHEN 'Zacapa' THEN 1900 WHEN 'Chiquimula' THEN 2000 WHEN 'Jalapa' THEN 2100
         WHEN 'Escuintla' THEN 500 WHEN 'Quetzaltenango' THEN 900 WHEN 'Huehuetenango' THEN 1300 WHEN 'Alta Verapaz' THEN 1600
         WHEN 'Petén' THEN 1700 WHEN 'Jutiapa' THEN 2200 ELSE -1 END AS sk_geografia,
       CASE te.tipo_estudio
         WHEN 'Hematología completa' THEN 7 WHEN 'Rayos X de tórax' THEN 8 WHEN 'Ultrasonido abdominal' THEN 18
         WHEN 'Tomografía computarizada' THEN 11 WHEN 'Resonancia magnética' THEN 12 WHEN 'Mamografía' THEN 13
         WHEN 'Electrocardiograma' THEN 14 WHEN 'Ecocardiograma' THEN 15 WHEN 'Espirometría' THEN 16 WHEN 'Papanicolaou' THEN 17
         ELSE -1 END AS sk_servicio,
       COUNT(*) AS servicios,
       ROUND(SUM(f.costo_q), 2) AS monto_cobrado
FROM fact_estudio f
JOIN dim_tiempo t ON t.tiempo_key = f.tiempo_key
JOIN dim_entidad e ON e.entidad_key = f.entidad_key
JOIN dim_tipo_estudio te ON te.tipo_estudio_key = f.tipo_estudio_key
WHERE f.estado = 'REALIZADO'
GROUP BY 1, 2, 3, 4

UNION ALL

-- Campañas: el mes es el de inicio; la geografía es la de la jornada (municipio si está en el catálogo del Grupo 8; si no, departamento; si no, -1).
SELECT t.anio * 10000 + t.mes * 100 + 1,
       10 + e.entidad_id,
       CASE
         WHEN g.municipio = 'Guatemala' AND g.departamento = 'Guatemala' THEN 101
         WHEN g.municipio = 'Mixco' THEN 108 WHEN g.municipio = 'Villa Nueva' THEN 115 WHEN g.municipio = 'Guastatoya' THEN 201
         WHEN g.municipio = 'Antigua Guatemala' THEN 301 WHEN g.municipio = 'Escuintla' AND g.departamento = 'Escuintla' THEN 501
         WHEN g.municipio = 'Quetzaltenango' AND g.departamento = 'Quetzaltenango' THEN 901 WHEN g.municipio = 'Huehuetenango' AND g.departamento = 'Huehuetenango' THEN 1301
         WHEN g.municipio = 'Cobán' THEN 1601 WHEN g.municipio = 'Flores' THEN 1701
         ELSE CASE g.departamento
           WHEN 'Guatemala' THEN 100 WHEN 'El Progreso' THEN 200 WHEN 'Sacatepéquez' THEN 300 WHEN 'Chimaltenango' THEN 400
         WHEN 'Santa Rosa' THEN 600 WHEN 'Sololá' THEN 700 WHEN 'Totonicapán' THEN 800 WHEN 'Suchitepéquez' THEN 1000
         WHEN 'Retalhuleu' THEN 1100 WHEN 'San Marcos' THEN 1200 WHEN 'Quiché' THEN 1400 WHEN 'Baja Verapaz' THEN 1500
         WHEN 'Izabal' THEN 1800 WHEN 'Zacapa' THEN 1900 WHEN 'Chiquimula' THEN 2000 WHEN 'Jalapa' THEN 2100
           WHEN 'Escuintla' THEN 500 WHEN 'Quetzaltenango' THEN 900 WHEN 'Huehuetenango' THEN 1300 WHEN 'Alta Verapaz' THEN 1600
           WHEN 'Petén' THEN 1700 WHEN 'Jutiapa' THEN 2200 ELSE -1 END
       END,
       19,
       SUM(c.personas_atendidas),
       0.00
FROM fact_campana c
JOIN dim_tiempo t ON t.tiempo_key = c.tiempo_inicio_key
JOIN dim_entidad e ON e.entidad_key = c.entidad_key
JOIN dim_geografia g ON g.geo_key = c.geo_key
WHERE c.personas_atendidas > 0
GROUP BY 1, 2, 3, 4
ORDER BY 2, 1, 3, 4;
