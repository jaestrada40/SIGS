import json, re
import os
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'   # carpeta docs/gestion
P = json.load(open('plan.json')); E = P['evm']; C = P['cadena_bd2']
f = DIR + '01_acta_y_alcance.md'
t = open(f).read()
a = t.index('## Parte A'); b = t.index('## Parte B')
A = f"""## Parte A. Acta de constitución del proyecto
Sigue la plantilla del curso (sesión 2, slide 27), en el mismo orden: título y propósito, justificación, objetivos y criterios de éxito,
alcance de alto nivel y exclusiones, interesados clave, hitos y cronograma preliminar, presupuesto estimado, riesgos y supuestos,
director de proyecto y su autoridad, y firma del patrocinador.

### 1. Título y propósito del proyecto
**Título:** SISG – Módulo del Grupo 4 (centros de diagnóstico y organismos no lucrativos).
**Propósito:** registrar pacientes, estudios diagnósticos y campañas de salud de dos tipos de actores del Sistema Integral de Salud de Guatemala,
y dejar esos datos listos para el análisis en un almacén de datos con modelo estrella.

### 2. Justificación / caso de negocio
El SISG busca que los actores del ecosistema de salud compartan datos de forma segura y consistente. El documento de la OPS [1] propone partir de una
**línea base**, definir una **arquitectura objetivo** y planear **transiciones**, con la interoperabilidad y la seguridad de la información como principios.
Los centros de diagnóstico y los organismos no lucrativos **alimentan y consumen** datos, pero hoy trabajan con archivos de Excel y bases aisladas. Sin un
modelo común, los ministerios, aseguradoras y universidades no pueden comparar estudios ni campañas por mes, tipo o lugar. Este módulo entrega ese modelo común
y demuestra, con datos de prueba, que los indicadores se calculan sin perder filas ni montos (reconciliación en cero).

### 3. Objetivos y criterios de éxito
**Objetivos SMART**

| # | Objetivo (específico, medible, con fecha) |
|---|---|
| O1 | Modelar las fuentes del Grupo 4 en un ER de tercera forma normal con llaves, restricciones e índices, **entregado el 25 de octubre de 2026** |
| O2 | Diseñar un modelo estrella de 2 hechos y 3 dimensiones conformadas, sin datos personales, y **presentarlo el 30 de octubre de 2026** |
| O3 | Automatizar el ETL con datos reales de la aplicación y lograr una reconciliación fuente–DW con diferencia 0 **antes del 5 de noviembre de 2026** |
| O4 | Responder al menos 8 preguntas de análisis con consultas sobre el modelo estrella **antes del 10 de noviembre de 2026** |
| O5 | Completar y validar con el grupo los documentos de gestión (alcance, EDT, cronograma y costos, interesados, comunicaciones, riesgos y calidad) **al 2 de noviembre de 2026** |
| O6 | Exponer en la semana 19 (**20–21 de noviembre**) y entregar el proyecto de Bases de Datos II **antes del 28 de noviembre de 2026 a las 8:00** |

**Criterios de éxito**
1. La reconciliación fuente–DW da diferencia 0 en filas y montos después de cada carga.
2. Las pruebas e2e de la aplicación pasan al 100% (49 de 49 al 24 de octubre).
3. El almacén de datos contiene 0 columnas con nombre, DPI o teléfono de pacientes.
4. Todas las entregas incluyen carátula, formato IEEE y el apéndice de declaración de uso de IA.
5. El plazo de Bases de Datos II se cumple con al menos 2 días de holgura (hoy: {C['holgura_dias']} días y ≈ {C['prob_cumplir_pct']}% de probabilidad).
6. Al menos 80% de las personas de una prueba de usabilidad registran un paciente sin ayuda.

### 4. Alcance de alto nivel y exclusiones
**Incluye:** aplicación web con autenticación con MFA obligatorio, roles (administrador, operador y auditor) y gestión de usuarios, módulos de pacientes, estudios y campañas, carga masiva por CSV y auditoría (incluidas las exportaciones); esquema fuente `sisg_fuente`;
almacén de datos `sisg_dw` con ETL y consultas; documentos de gestión; exposición e informe de cierre.
**Excluye:** integración real con los otros grupos y con el Gestor de plataforma (Grupo 8); puesta en producción y HTTPS real; recuperación de contraseña por correo;
carga incremental del ETL; carga de archivos `.xlsx` (se acepta CSV); tableros de BI externos; aplicaciones móviles nativas. El detalle está en la Parte B.

### 5. Interesados clave
Docentes (patrocinadores académicos), equipo del Grupo 4, Gestor de plataforma (Grupo 8), Ministerio de Salud/INE/Estado, hospitales y red pública,
seguro social, centros de diagnóstico y organismos no lucrativos (usuarios), consumidores de datos (aseguradoras, organismos internacionales, universidades) y pacientes.
El registro completo con poder, interés y estrategia está en `03_interesados_comunicaciones.md`.

### 6. Hitos y cronograma preliminar
| Fecha | Hito |
|---|---|
| 25 oct. 2026 | ER de las fuentes (Bases de Datos II) – entregado |
| 30 oct. 2026 | Presentación del diseño estrella (Bases de Datos II) |
| 2 nov. 2026 | Documentos de gestión validados |
| 5 nov. 2026 | ETL con datos reales de la aplicación |
| 10 nov. 2026 | Consultas y análisis `EXPLAIN` finales |
| 20–21 nov. 2026 | Exposición final (Administración de Proyectos, semana 19) |
| 22–28 nov. 2026 | Examen final de Administración de Proyectos |
| **28 nov. 2026, 8:00** | **Entrega del proyecto final de Bases de Datos II** |

El cronograma detallado, la ruta crítica y el PERT están en `02_edt_cronograma_costos.md`.

### 7. Presupuesto estimado
No hay gasto monetario directo (**Q 0**): se usan Docker y software libre en equipos propios. El costo se mide en **horas-persona**:
**BAC = {E['BAC']} h**; reserva de contingencia {E['contingencia']} h ({E['contingencia_pct']}%); reserva de gestión {E['gestion_5pct']} h (5%);
presupuesto con reservas = **{round(E['BAC'] + E['contingencia'] + E['gestion_5pct'], 1)} h**. Las horas son estimaciones iniciales que el grupo debe validar.

### 8. Riesgos y supuestos
**Riesgos principales** (registro completo en `04_riesgos_calidad.md`):
| Id | Riesgo | Nivel |
|---|---|---|
| R2 | El plazo de Bases de Datos II tiene {C['holgura_dias']} días de holgura y coincide con el examen final | Crítico |
| R12 | Fuga de datos de salud de la aplicación (credenciales robadas, descarga masiva) | Alto |
| R5 | Sobrecarga de un integrante (equipo de 3 personas) | Alto |
| R8 | Omitir la declaración de uso de IA limita la nota al 60% | Alto |
| R4 | Otros grupos no definen sus formatos de datos a tiempo | Alto |

**Supuestos:** el grupo dispone de Docker y de un equipo para ejecutar las bases; los datos de prueba son sintéticos; los demás grupos entregarán datos que el ETL pueda leer
(Excel o MySQL, según el diagrama del Grupo 8); las horas y los porcentajes de avance de este borrador se validarán con el grupo.
**Restricciones:** plazo fijo del 28 de noviembre; equipo de 3 personas; el curso de Bases de Datos II enseña SQL Server; el grupo decidió que el almacén se implementa en MySQL (decisión definitiva del 24 de octubre).

### 9. Director de proyecto y su autoridad
**Director de proyecto (líder):** *por asignar por el grupo*.
**Autoridad:** aprobar cambios de alcance dentro del equipo y registrarlos; reasignar paquetes de trabajo; usar las reservas de contingencia y de gestión;
convocar la reunión semanal; escalar a los docentes lo que excede la autoridad del equipo (por ejemplo, el motor de base de datos o el alcance de una entrega).

| Rol | Responsabilidad | Persona |
|---|---|---|
| Líder de proyecto | Planificación, seguimiento y comunicación con docentes | *por asignar* |
| Responsable de datos | ER, modelo estrella, ETL, consultas | *por asignar* |
| Responsable de aplicación y calidad | Aplicación web, pruebas, documentación | *por asignar* |

### 10. Firma del patrocinador
Patrocinadores académicos: Ing. Rafael G. Barrios Parra (Administración de Proyectos Tecnológicos) e Inga. Claudia Alegre (Bases de Datos II).

Firma y fecha: ____________________   ·   ____________________

---

"""
t = t[:a] + A + t[b:]
open(f, 'w').write(t)
print(len(t))
