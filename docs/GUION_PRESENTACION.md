# SISG · Guion para exponer (13 diapositivas)

Tiempo sugerido: 13 a 16 minutos. Es el mismo texto de las notas del orador de la presentación en Canva. Las cifras salen de lo medido en el proyecto; si algo cambia, corrígelo aquí y en la diapositiva.

**Reparto sugerido (3 integrantes):** diapositivas 1 a 3 (presentación y arquitectura), 4 a 9 (datos, aplicación e integración con el Grupo 8, Bases de Datos II), 10 a 13 (gestión y cierre, Administración de Proyectos). Ajústenlo al grupo.

---

## 1. Portada · ~30 s
Buenos días. Somos el Grupo 4 y presentamos SISG, el Sistema de Información de Salud de Guatemala. Es un solo proyecto que entregamos en dos cursos: en Bases de Datos II mostramos el diseño y el análisis de los datos, y en Administración de Proyectos Tecnológicos mostramos cómo lo planificamos y gestionamos. Primero veremos el producto y los datos, y al final la gestión.

## 2. El problema y el alcance · ~1 min
Los centros de diagnóstico y las organizaciones no lucrativas ya registran pacientes, estudios y campañas, pero cada uno por su lado. Sin integrar esos datos no pueden medir cuánto ingresan, a cuántas personas llegan ni cuántos referidos terminan en un estudio. SISG integra esos tres datos (pacientes, estudios, campañas) en una aplicación y en un almacén de datos para analizarlos. El plazo es fijo: entrega el 28 de noviembre de 2026.

## 3. Arquitectura · ~1 min
A la izquierda está la aplicación, con su base transaccional llamada `sisg`: normalizada, pensada para registrar rápido. A la derecha está el almacén de datos, con la fuente `sisg_fuente` y la estrella `sisg_dw`, pensado para consultar rápido. Las dos son MySQL 8. Las separamos por tres razones: el ETL necesita un origen y un destino; el análisis pesado no debe competir con quien registra pacientes; y una base normalizada y una estrella no pueden convivir en el mismo esquema. Un proceso ETL, con un puente que exporta, mapea, carga y reconcilia, las une.

## 4. ER de las fuentes · ~1.5 min
Este es el modelo entidad-relación de las fuentes, en la base `sisg_fuente`: 10 tablas y 13 llaves foráneas. Usamos catálogos en lugar de texto libre: departamento, municipio, tipo de entidad, tipo de estudio y área de campaña. Un estudio pertenece a un paciente y a un centro; un paciente reside en un municipio que pertenece a un departamento. Las llaves foráneas garantizan que no haya estudios sin paciente. También hay una bitácora de auditoría y triggers que validan estudios y campañas antes de guardarlos.

## 5. Modelo estrella · ~2 min
El modelo es una constelación de hechos: dos estrellas que comparten dimensiones. La primera tiene el hecho `fact_estudio`, con un registro por estudio diagnóstico, y las dimensiones de tiempo, entidad, geografía, paciente, tipo de estudio y grupo etario. La segunda tiene `fact_campana`, con un registro por campaña de salud, y las dimensiones de tiempo (inicio y fin), entidad, geografía y área de campaña. Las dimensiones conformadas, compartidas por las dos, son tiempo, geografía y entidad; por eso se pueden cruzar estudios y campañas. Son dos hechos porque son procesos con granos distintos; mezclarlos en una tabla sería incorrecto. Es estrella y no copo de nieve porque las dimensiones son tablas planas, sin subdimensiones. Abajo a la derecha está `fact_estudio_mensual`, la tabla de sumarización.

## 6. ETL · ~1.5 min
El ETL tiene tres pasos. Extrae de `sisg_fuente`. Transforma: limpia, calcula la edad y el grupo etario, y asigna claves sustitutas; los datos sin municipio o sin fecha de nacimiento van a un miembro desconocido, con clave menos uno, para no perder hechos. Y carga el estrella. Está hecho con procedimientos almacenados: el principal es `sp_etl_completo`. Cada ejecución queda en la tabla `etl_log`, con inicio, fin, filas y estado. La última carga fue de 12,507 estudios, 150 campañas y 1,758 filas de resumen. Para comprobar que cargó bien, la reconciliación compara filas y montos entre fuente y almacén y da diferencia cero. Hoy es una recarga completa; una carga incremental sería el siguiente paso.

## 7. Consultas, vistas y desempeño · ~1.5 min
Sobre el estrella escribimos ocho consultas analíticas, y cada una tiene su vista, con nombre `v_…`; por ejemplo, `v_estudios_mes_categoria`. La consulta 1 responde cuántos estudios hay por mes y categoría sobre `fact_estudio`, con 12,507 estudios, y tarda unos 11 milisegundos. La consulta 8 hace la misma pregunta sobre la tabla de sumarización `fact_estudio_mensual`, con 1,758 filas, y tarda 1.6 milisegundos: unas 7 veces más rápida. Medimos el promedio de 50 ejecuciones, repetido 3 veces, en MySQL 8 con datos sintéticos. Es una prueba de la eficiencia de desempeño del plan de calidad.

## 8. La aplicación en funcionamiento · ~2 min (con demo en vivo si hay tiempo)
Esta es la aplicación que alimenta los datos, con información de ejemplo. Cada entidad ve solo lo suyo y hay tres roles: administrador, operador y auditor. El MFA es obligatorio y todo queda en una bitácora de auditoría. Aquí se ve una organización no lucrativa con 25 pacientes, 6 campañas y 660 personas atendidas, y un panel de alertas que avisa, por ejemplo, de campañas sin costo. También hay un panel de impacto, referidos entre el organismo y el centro, exportación FHIR y un enlace seguro para entregar resultados. La aplicación tiene 103 pruebas automáticas de extremo a extremo que pasan.

*Demo en vivo (opcional):* entrar con un administrador (ver `docs/GUIA_PRESENTACION.md`, sección 2b), mostrar Impacto y Referidos. Tengan el MFA ya configurado antes de exponer.

## 9. Integración con la plataforma del Grupo 8 · ~1.5 min
Hasta aquí todo es nuestro: la aplicación genera los datos y nuestro almacén los modela. Ahora cerramos el ciclo con el resto del sistema de salud. El Grupo 8 es el gestor de la plataforma: tiene un almacén central, `sisg_analitica`, en MySQL, donde convergen los siete grupos de datos. Nosotros, como Grupo 4 (centros de diagnóstico y organismos no lucrativos), le aportamos un resumen, no la base completa. De nuestro almacén calculamos un agregado mensual: servicios y monto cobrado por mes, establecimiento, ubicación y tipo de servicio. Ese resumen, 1,908 filas de 14 establecimientos, se inserta en nuestra tabla buzón `ingesta_g4_servicio`; un disparador en el servidor lo valida contra sus catálogos y lo copia a `fact_servicio`, que consumen otros grupos, como las aseguradoras. No viajan pacientes ni datos personales: solo cifras agregadas. Antes de enviar validamos, solo con lectura, que todas nuestras llaves existieran en sus catálogos: cero inválidas. Y el portal del Grupo 8 ya muestra nuestros datos en el tablero del Grupo 4.

*Demo (opcional, solo si hay Internet):* abrir el portal del Grupo 8, entrar con el usuario del Grupo 4 y mostrar el tablero. Tengan lista una captura por si la red falla. Las primeras filas de la tabla son 10 datos de prueba del Grupo 8, no nuestros: desplácense hasta nuestros establecimientos.

## 10. Gestión: alcance y cronograma · ~1.5 min
Pasamos a la gestión del proyecto. Usamos un enfoque híbrido: predictivo para acordar el plan, con alcance, hitos y dependencias; y ágil para construir, en iteraciones cortas con revisión y ajuste. El plazo es fijo, el 28 de noviembre, y el equipo es de tres personas. La documentación incluye el acta de constitución y alcance, la EDT con la regla del 100 por ciento, el cronograma con ruta crítica, PERT y Gantt, el registro de interesados con la matriz poder-interés, el plan de comunicaciones y el reporte de estado con CPI y SPI. Los valores finales de CPI y EAC dependen de las horas reales trabajadas, que el grupo está completando.

## 11. Riesgos y calidad · ~1.5 min
Los riesgos los valoramos con una matriz de 3 por 3, probabilidad contra impacto, y escribimos el porqué de cada valor para que otra persona llegue a la misma conclusión. Las respuestas a amenazas son evitar, transferir, mitigar, aceptar o escalar. Un ejemplo: existía el riesgo de que la docente exigiera SQL Server; el grupo decidió el 24 de octubre que MySQL es definitivo y el riesgo se cerró. También separamos severidad de riesgo: una vulnerabilidad con puntaje alto puede dejar un riesgo bajo. Para calidad usamos ISO/IEC 25010 con metas medibles: corrección, con la reconciliación en diferencia cero; eficiencia, con la consulta 8 unas 7 veces más rápida; y seguridad, con MFA obligatorio y acceso por rol.

## 12. Lecciones aprendidas · ~1 min
Lo que funcionó: separar la operación de la analítica, reconciliar la fuente contra el almacén para confiar en el ETL, y tener 103 pruebas automáticas de extremo a extremo. Lo que haríamos distinto: decidir el motor de base de datos al inicio; la aplicación nació en PostgreSQL y migrarla a MySQL obligó a reescribir el SQL escrito a mano. Y las pruebas deben correr sobre una base propia: descubrimos tarde que apuntaban a la base de desarrollo y la vaciaban en cada corrida. Lo corregimos fijando la base de pruebas.

## 13. Cierre y declaración de IA · ~1 min
Resumo. Para Bases de Datos II entregamos el ER de las fuentes, el modelo estrella, el ETL y las consultas con sus vistas, más una aplicación que genera los datos. Para Administración de Proyectos entregamos el plan: acta, EDT, cronograma, interesados, comunicaciones, riesgos y calidad. Declaramos el uso de inteligencia artificial: se usó para código, documentos y esta presentación, y el detalle, con la herramienta, el propósito y el nivel de modificación, está en el apéndice. Gracias; quedamos atentos a sus preguntas.

---

## Preguntas probables (respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| ¿Por qué dos bases? | Una es la aplicación (transaccional) y otra es el almacén. El curso pide el almacén aparte; las dos son MySQL, que el grupo eligió. |
| ¿Por qué MySQL si el curso usa SQL Server? | Decisión del grupo el 24 de octubre. El riesgo de que se exigiera SQL Server quedó registrado y cerrado; `dw/README.md` trae la tabla de equivalencias a T-SQL. |
| ¿Estrella o copo de nieve? | Estrella: las dimensiones son tablas planas, sin subdimensiones. |
| ¿Por qué dos hechos? | Estudio y campaña son procesos con granos distintos. |
| ¿Cómo saben que el ETL cargó bien? | La reconciliación compara filas y montos entre fuente y almacén: diferencia 0. |
| ¿Es una carga incremental? | No: es recarga completa. La incremental, con marca de agua en `etl_log`, es el siguiente paso. |
| ¿Los datos son reales? | No: el almacén usa datos sintéticos y la aplicación, datos de ejemplo. Los costos y duraciones del almacén vienen de precios de lista, no de cobros reales. |
| ¿Qué le mandan al Grupo 8? | Solo un agregado mensual (servicios y monto por mes, establecimiento, ubicación y servicio) en `ingesta_g4_servicio`. Sin pacientes ni datos personales. |
| ¿Cómo saben que llegó bien? | Validamos con solo lectura contra sus catálogos: 0 llaves inválidas, 1,908 de 1,908 filas ya en su `fact_servicio` y sin diferencias de valores (`dw/g8/02_resultado_validacion.txt`). |
| ¿Por qué hay más filas de las suyas en su tablero? | Hay 10 filas de prueba del Grupo 8 (establecimientos 8 a 10, año 2024). Los totales propios son 1,908 filas y 52,004 servicios. |
| ¿Y la seguridad? | Rol `analista` de solo lectura en el almacén, MFA obligatorio, roles por entidad, bitácora de auditoría y llaves foráneas. |
