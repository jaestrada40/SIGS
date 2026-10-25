# Prompt para Lovable – interfaz de SISG (Grupo 4)

Pégalo completo en Lovable. Si el resultado sale muy largo o se rompe algo, usa luego los "prompts de seguimiento" del final, de uno en uno.

---

## PROMPT

Diseña y construye el frontend de **SISG (Sistema Integral de Salud de Guatemala) – Módulo Grupo 4**: una aplicación web para **centros de diagnóstico** y **organismos no lucrativos** (ligas de salud, APROFAM) que registran pacientes, estudios diagnósticos y campañas de salud. Usa React + TypeScript + Tailwind + shadcn/ui, en español de Guatemala (trato de "usted"), y conéctala a mi API REST existente (contrato más abajo). **No uses Supabase ni inventes endpoints.**

### 1. Sensación que busco
Quiero una interfaz **cálida, confiable y "lovable"**, con **profundidad y personalidad**. **NO quiero un estilo plano ni minimalista estilo Notion/documento**: nada de pantallas blancas con solo bordes grises y texto. Debe sentirse como una app de salud moderna y humana: amable, viva, que dé gusto usar a una recepcionista a las 8 de la mañana, pero seria con datos médicos.

### 2. Dirección visual
- **Color:** base blanco verdoso muy claro (`#F4FAF8`) con superficies blancas; primario **verde azulado profundo** (`#0E7C6B`) con degradados sutiles hacia `#14B8A6`; acento cálido **ámbar** (`#F5A524`) y **coral** (`#FF7A66`) para resaltar; texto en azul tinta (`#12263A`). Cada tipo de dato con su propio color de apoyo (pacientes = verde azulado, estudios = azul `#3B82F6`, campañas = coral, personas atendidas = ámbar). Define todo como variables CSS y que funcione en **modo claro y oscuro**.
- **Profundidad:** tarjetas con esquinas de 16–20 px, **sombras suaves en capas** (elevación), un borde claro de 1 px y un leve brillo/degradado superior; al pasar el cursor, las tarjetas **se elevan** un poco. Fondos con **degradados suaves** y un patrón geométrico muy tenue inspirado en **textiles guatemaltecos** (rombos y líneas escalonadas, apenas visible, nunca estridente).
- **Tipografía:** títulos en **Plus Jakarta Sans** (700–800), cuerpo en **Inter** o **DM Sans**; números grandes con cifras tabulares. Iconos de **Lucide** en trazo medio, cada uno dentro de un **chip de color** redondeado.
- **Ilustración y vida:** ilustraciones vectoriales sencillas y amables (manos cuidando, corazón, lupa, microscopio) en los estados vacíos, el inicio de sesión y el saludo. Sin fotos de stock.
- **Movimiento (con moderación):** contadores que suben al cargar, esqueletos de carga con brillo, transiciones de 150–250 ms, un **momento de celebración** (confeti discreto) al registrar el primer paciente. Respeta `prefers-reduced-motion`.
- **Prohibido:** Lorem ipsum, degradados morados genéricos, exceso de emojis, tablas apretadas sin aire, texto gris claro difícil de leer.

### 3. Pantallas
1. **Inicio de sesión / registro de entidad:** pantalla dividida. A la izquierda, un panel con degradado, ilustración y una frase corta ("Un solo registro para la salud de Guatemala"). A la derecha, el formulario con pestañas *Iniciar sesión* / *Registrar entidad*. Al registrar, el tipo de entidad se elige con **dos tarjetas grandes** (Centro de diagnóstico / Organismo no lucrativo), con icono y una línea de descripción. Medidor de fortaleza de contraseña y mensajes de error claros.
2. **Inicio (dashboard):** **tarjeta de bienvenida** con degradado, saludo según la hora ("Buenos días, Centro El Roble"), una frase útil y un botón principal; **tarjetas de resumen** con número grande, icono en chip de color y minigráfica (sparkline); **acciones rápidas** como mosaicos de color (Nuevo paciente, Nuevo estudio o Nueva campaña, Importar CSV, Ver actividad); una **gráfica de área** (estudios por mes o campañas por área) calculada en el cliente con los datos de las listas; y **actividad reciente** como línea de tiempo con icono, etiqueta de color y tiempo relativo ("hace 4 minutos").
3. **Pacientes:** búsqueda, filtros en chips (sexo, estado, departamento), tabla con filas cómodas y avatar con iniciales de color, y **panel lateral (drawer)** para ver y editar. Botón **Importar CSV** que abre un **cuadro de arrastrar y soltar**, con vista previa y **errores por fila** (ver contrato) y enlace a la plantilla.
4. **Estudios** (solo centros): igual estructura; estado como etiqueta (Programado, Realizado, Cancelado); selector de paciente con búsqueda; importación por DPI.
5. **Campañas** (solo organismos): vista de **tarjetas** con área (icono y color), lugar, fechas, estado (Programada, En curso, Finalizada) y personas atendidas con barra de progreso.
6. **Actividad:** línea de tiempo completa, solo lectura, con filtros por acción.
7. **Estado vacío, carga y error** diseñados para cada lista: ilustración, una frase amable y el botón de la acción siguiente.

### 4. Navegación y roles
Barra lateral con indicador de color en el ítem activo, logo y nombre de la entidad con su etiqueta de tipo; barra superior con búsqueda rápida (⌘K) y menú de usuario (cerrar sesión). En celular, la barra lateral se convierte en menú deslizable y las tablas pasan a **tarjetas**. Un **centro** ve Pacientes, Estudios y Actividad; un **organismo** ve Pacientes, Campañas y Actividad.

### 5. Contrato de la API (no lo cambies)
Base: variable `VITE_API_URL` (por defecto `http://localhost:3000`). Todas las rutas, salvo `/auth/*`, llevan `Authorization: Bearer <token>`. Un 401 cierra la sesión.

| Método y ruta | Cuerpo / respuesta |
|---|---|
| `POST /auth/registro` | `{nombre, tipo: "CENTRO_DIAGNOSTICO"\|"ORG_NO_LUCRATIVA", correo, password (mín. 8), departamento?, telefono?}` → `{access_token, entidad:{id,nombre,tipo}}` |
| `POST /auth/login` | `{correo, password}` → igual que arriba |
| `GET /dashboard` | Centro: `{totalPacientes, totalEstudios}` · Organismo: `{totalPacientes, totalCampanas, totalPersonasAtendidas}` |
| `GET/POST /pacientes`, `GET/PATCH /pacientes/:id` | Campos: `nombreCompleto*, sexo* ("F"\|"M"\|"NE"), dpi, fechaNacimiento (aaaa-mm-dd), departamento, municipio, telefono, contactoEmergencia, estado` |
| `POST /pacientes/importar` | `{filas:[{...campos de paciente}]}` → `{importados}` |
| `GET/POST /estudios`, `GET/PATCH /estudios/:id` (solo centros) | `pacienteId*, tipoEstudio*, fecha*, hora (HH:MM), salaEquipo, especialista, estado, resultado` |
| `POST /estudios/importar` (solo centros) | `{filas:[{dpi*, tipoEstudio*, fecha*, hora, salaEquipo, especialista, estado, resultado}]}` → `{importados}` |
| `GET/POST /campanas`, `GET/PATCH /campanas/:id` (solo organismos) | `nombre*, area* ("CARDIOVASCULAR"\|"RESPIRATORIA"\|"PLANIFICACION"\|"ONCOLOGICO_OTRO"), fechaInicio*, fechaFin, departamento, ubicacion, personasAtendidas (entero ≥ 0), estado ("PROGRAMADA"\|"EN_CURSO"\|"FINALIZADA")` |
| `GET /bitacora` | Últimos 200 movimientos de la entidad: `[{id, tabla, registroId, accion:"CREAR"\|"MODIFICAR"\|"IMPORTAR", detalle:{campos?:string[], filas?:number}\|null, creadoEn}]` |

**Importación (todo o nada):** hasta 1,000 filas; si alguna falla, la API responde `400 {message, errores:[{fila, mensaje}]}` y **no importa nada**. La fila 1 es el encabezado. Muestra esos errores en una lista clara. Acepta CSV con coma o punto y coma y fechas `dd/mm/aaaa` (conviértelas a `aaaa-mm-dd` antes de enviar). Los errores de validación llegan como `{message: string | string[]}`.

### 6. Reglas
- **Privacidad:** son datos de salud. Nunca pongas nombres, DPI ni teléfonos en la URL ni en el título de la pestaña, y no los registres en consola.
- **Accesibilidad (WCAG AA):** contraste suficiente, foco visible, navegación con teclado, etiquetas en los campos, el estado nunca solo por color.
- **Rendimiento y estructura:** un cliente de API tipado, componentes reutilizables, y los tokens de diseño en un solo lugar.
- Texto de interfaz en español, fechas como `dd/mm/aaaa`, números con separador de miles.

### 7. Entrégame
Primero el **sistema de diseño** (colores, tipografía, tarjetas, botones, etiquetas, estados vacíos) y las pantallas **Inicio de sesión** e **Inicio**; después seguimos con las demás.

---

## Prompts de seguimiento (de uno en uno)
1. *"Ahora construye Pacientes con búsqueda, filtros en chips, avatar con iniciales de color, drawer de detalle y edición, y el cuadro de importar CSV con errores por fila."*
2. *"Ahora Estudios (solo centros) y Campañas (solo organismos), con las etiquetas de estado y las tarjetas de campaña con barra de progreso."*
3. *"Agrega la pantalla de Actividad como línea de tiempo y el momento de celebración al registrar el primer paciente."*
4. *"Revisa la versión móvil: menú deslizable, tablas como tarjetas y espacios táctiles de 44 px."*
5. *"Agrega el modo oscuro con las mismas variables y revisa el contraste."*
