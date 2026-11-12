# Prueba de usabilidad de SISG (Grupo 4)

Mide la fila **Usabilidad** de la TABLA VII (`04_riesgos_calidad.md`): *% de personas que registran un paciente sin ayuda*. Mínimo 80 %, meta 95 %.

## 1. Preparación (15 min, el equipo)
- [ ] Levantar la aplicación (`backend`: `npm run start:dev`; `nuevo-diseño`: `npm run dev`) y abrir http://localhost:8080.
- [ ] Crear **dos entidades de práctica**, cada una con un usuario **operador** ya activado (con MFA hecho): un **centro de diagnóstico** (tareas 1, 2 y 4) y un **organismo no lucrativo** (tarea 3), porque los estudios solo existen en centros y las campañas solo en organismos. El MFA se evalúa aparte, en la tarea 0, con una cuenta nueva.
- [ ] Tener un celular con una app de autenticación, solo para la tarea 0.
- [ ] Preparar la hoja de datos ficticios de la sección 3. **No usar datos de personas reales.**
- [ ] Un cronómetro y la hoja de resultados (sección 5). Roles: un **facilitador** que habla con la persona y un **observador** que anota sin intervenir.

**Participantes:** 3 a 5 personas que no hayan construido el sistema (compañeros de otro grupo, familiares, alguien de un centro de salud si se puede). Cada sesión dura unos 20 minutos.

## 2. Guion del facilitador
Leer en voz alta:

> «Estamos probando el sistema, no a usted. Si algo no se entiende, el problema es del sistema. Piense en voz alta mientras lo usa. No le voy a ayudar a menos que usted me lo pida o lleve más de 3 minutos atascado. Puede parar cuando quiera.»

Reglas:
- No explicar la pantalla ni señalar botones. Si pide ayuda, **anotar «con ayuda»** y dar solo la pista mínima.
- Si pasan **3 minutos** sin avanzar, anotar «no completó» y pasar a la siguiente tarea.
- Anotar cada duda, error y comentario textual.

## 3. Tareas (datos ficticios)
Entregar cada tarea en una tarjeta, sin decir dónde está el botón.

| # | Tarea | Éxito si… |
|---|---|---|
| 0 | Ingrese al sistema con el correo y la contraseña dados y active la verificación en dos pasos. | Llega a la pantalla de inicio. |
| **1** | **Registre a la paciente Ana López, mujer, nacida el 12/03/1990, de Quetzaltenango.** | **El paciente aparece en la lista. Es la tarea que mide la meta.** |
| 2 | *(cuenta del centro)* Registre un estudio de ultrasonido para Ana López, hoy, con costo de Q250. | El estudio aparece asociado a Ana. |
| 3 | *(cuenta del organismo)* Cree la campaña «Jornada de salud del corazón», área cardiovascular, en Huehuetenango, que empieza el mes próximo. | La campaña aparece en la lista. |
| 4 | Encuentre cuántos pacientes y estudios hay registrados. | Dice las cifras correctas. |

## 4. Cuestionario final (escala SUS)
Después de las tareas, la persona marca de 1 (muy en desacuerdo) a 5 (muy de acuerdo):

1. Creo que me gustaría usar este sistema con frecuencia.
2. Encontré el sistema innecesariamente complejo.
3. Pensé que el sistema era fácil de usar.
4. Creo que necesitaría ayuda de una persona técnica para usarlo.
5. Encontré que las funciones estaban bien integradas.
6. Pensé que había demasiada inconsistencia en el sistema.
7. Imagino que la mayoría de las personas aprendería a usarlo rápido.
8. Encontré el sistema muy incómodo de usar.
9. Me sentí con mucha confianza usando el sistema.
10. Necesité aprender muchas cosas antes de poder usarlo.

**Cálculo del puntaje SUS:** en las preguntas impares restar 1 a la respuesta; en las pares restar la respuesta a 5. Sumar los diez valores y multiplicar por 2.5. Resultado de 0 a 100: **68** es el promedio de referencia y **80 o más** es muy bueno.

Preguntas abiertas: ¿qué fue lo más difícil? ¿Qué cambiaría primero? ¿Qué le gustó?

## 5. Hoja de resultados
Una fila por persona y tarea: ✔ sin ayuda, ⚠ con ayuda, ✘ no completó. Anotar el tiempo en segundos.

| Persona | Perfil | T0 | T1 | Tiempo T1 | T2 | T3 | T4 | SUS | Observaciones |
|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | |
| P2 | | | | | | | | | |
| P3 | | | | | | | | | |
| P4 | | | | | | | | | |
| P5 | | | | | | | | | |

**Indicadores:**
- **Tasa de éxito sin ayuda (tarea 1)** = personas con ✔ en T1 ÷ personas probadas. Con 5 personas, 4 ✔ da 80 % (mínimo) y 5 ✔ da 100 %. Con 3 personas, 3 ✔ da 100 % y 2 ✔ da 67 %, que no cumple el mínimo.
- **Tiempo medio de la tarea 1** y **SUS promedio**.
- **Problemas encontrados**, ordenados por cuántas personas los sufrieron y qué tan grave fue (bloquea / retrasa / molesta).

## 6. Después de la prueba
- [ ] Llenar la fila de la TABLA VII con el resultado real (porcentaje, n personas y fecha) y marcar la casilla en `PENDIENTES.md`.
- [ ] Listar los 3 problemas más graves y decidir cuáles se corrigen antes del 28 de noviembre.
- [ ] Si la tasa de éxito queda bajo 80 %, corregir lo observado y repetir con 2 o 3 personas nuevas.
- [ ] Guardar las hojas y las notas como evidencia del entregable de calidad.
- [ ] Declarar en el informe que la muestra es pequeña (3 a 5 personas): sirve para detectar problemas, no para estimar con precisión.
