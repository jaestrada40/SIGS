-- Control de calidad del ETL: la fuente y el DW deben cuadrar en filas y montos. Cualquier diferencia ≠ 0 es un defecto.
SELECT 'estudios' AS control,
       (SELECT COUNT(*) FROM sisg_fuente.estudio) - (SELECT COUNT(*) FROM sisg_dw.fact_estudio) AS dif_filas,
       (SELECT COALESCE(SUM(costo_q),0) FROM sisg_fuente.estudio WHERE estado='REALIZADO')
     - (SELECT COALESCE(SUM(costo_q),0) FROM sisg_dw.fact_estudio WHERE estado='REALIZADO') AS dif_monto
UNION ALL
SELECT 'campañas',
       (SELECT COUNT(*) FROM sisg_fuente.campana) - (SELECT COUNT(*) FROM sisg_dw.fact_campana),
       (SELECT COALESCE(SUM(personas_atendidas),0) FROM sisg_fuente.campana)
     - (SELECT COALESCE(SUM(personas_atendidas),0) FROM sisg_dw.fact_campana)
UNION ALL
SELECT 'resumen mensual',
       0,
       (SELECT COALESCE(SUM(ingresos_q),0) FROM sisg_dw.fact_estudio_mensual)
     - (SELECT COALESCE(SUM(costo_q),0) FROM sisg_dw.fact_estudio WHERE estado='REALIZADO');
