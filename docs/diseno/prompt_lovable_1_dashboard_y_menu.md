# Prompt 1 para Lovable – Sistema de diseño, menú y dashboard

Pégalo completo en Lovable **primero**. Después usa `prompt_lovable_2_pacientes.md`.

---

## PROMPT

Construye la base del frontend de **SISG (Sistema Integral de Salud de Guatemala) – Módulo Grupo 4**: una aplicación web para **centros de diagnóstico** y **organismos no lucrativos** (ligas de salud, APROFAM) que registran pacientes, estudios y campañas de salud. Usa React + TypeScript + Tailwind + shadcn/ui, textos en **español de Guatemala** (trato de "usted") y conéctala a mi API REST existente. **No uses Supabase ni inventes endpoints.**

En este paso entrégame solo tres cosas: **(A) el sistema de diseño, (B) el menú y la estructura general (layout) y (C) la pantalla de Inicio (dashboard)**. Las demás pantallas las pediré después, así que deja las rutas `/pacientes`, `/estudios`, `/campanas` y `/actividad` con una página provisional que diga "Próximamente" dentro del mismo layout.

### Sensación que busco
Interfaz **cálida, confiable y "lovable"**, con **profundidad y personalidad**. **No quiero un estilo plano ni minimalista tipo Notion o documento**: nada de pantallas blancas con solo bordes grises. Debe sentirse como una app de salud moderna y humana, amable y viva, pero seria con datos médicos.

### A. Sistema de diseño
- **Color** (variables CSS, modo claro y oscuro): fondo `#F4FAF8`; superficies blancas; primario verde azulado `#0E7C6B` con degradado sutil hacia `#14B8A6`; acentos ámbar `#F5A524` y coral `#FF7A66`; texto azul tinta `#12263A`. Colores de apoyo por tipo de dato: pacientes = verde azulado, estudios = azul `#3B82F6`, campañas = coral, personas atendidas = ámbar.
- **Profundidad:** tarjetas con esquinas de 16–20 px, sombras suaves en capas, borde claro de 1 px y un leve brillo superior; al pasar el cursor se elevan un poco. Fondo con degradados suaves y un patrón geométrico muy tenue inspirado en textiles guatemaltecos (rombos y líneas escalonadas), casi invisible.
- **Tipografía:** títulos en **Plus Jakarta Sans** (700–800), cuerpo en **Inter**; números grandes con cifras tabulares.
- **Iconos:** Lucide en trazo medio, cada uno dentro de un **chip de color** redondeado.
- **Componentes base** que deben quedar reutilizables: Card, StatCard, Badge/etiqueta de color, Button (primario, secundario, fantasma), EmptyState con ilustración, Skeleton con brillo, Toast.
- **Movimiento (con moderación):** transiciones de 150–250 ms, contadores que suben al cargar, esqueletos al cargar. Respeta `prefers-reduced-motion`.
- **Prohibido:** Lorem ipsum, degradados morados genéricos, exceso de emojis, texto gris claro difícil de leer.

### B. Menú y layout
- **Barra lateral** (240 px): logo SISG; bloque con el nombre de la entidad y su etiqueta de tipo (Centro de diagnóstico / Organismo no lucrativo); ítems con icono en chip e **indicador de color** en el ítem activo (barra lateral y fondo tintado); pie con "Cerrar sesión".
- **Ítems por rol:** un **centro** ve Inicio, Pacientes, Estudios y Actividad; un **organismo** ve Inicio, Pacientes, Campañas y Actividad. El rol sale de `entidad.tipo`.
- **Barra superior:** título de la página con migas de pan, búsqueda rápida (⌘K, solo visual por ahora) y menú de usuario con avatar de iniciales.
- **Celular:** la barra lateral pasa a **menú deslizable** con botón de hamburguesa y fondo oscurecido; se cierra con Escape, tocando fuera o al elegir una página. Zonas táctiles de 44 px.
- **Sesión:** si no hay token, redirige a `/login` (pantalla provisional). Un 401 de la API cierra la sesión.

### C. Pantalla de Inicio (dashboard)
1. **Tarjeta de bienvenida** con degradado, ilustración sencilla (manos cuidando o corazón) y saludo según la hora: *"Buenos días, {nombre de la entidad}"*. Debajo, una frase útil según el rol y el botón principal ("Nuevo paciente").
2. **Tarjetas de resumen** (StatCard): número grande con contador animado, icono en chip de color y minigráfica (sparkline). Centro: Pacientes y Estudios. Organismo: Pacientes, Campañas y Personas atendidas.
3. **Acciones rápidas** como mosaicos de color con icono y una línea de descripción: Nuevo paciente, Nuevo estudio (centro) o Nueva campaña (organismo), Importar CSV, Ver actividad.
4. **Gráfica de área** (Recharts): *Estudios por mes* para centros, *Personas atendidas por área* para organismos, calculada en el cliente con los datos de las listas (`GET /estudios` por `fecha`, `GET /campanas` por `area`).
5. **Actividad reciente:** línea de tiempo con las 5 últimas entradas de `GET /bitacora`: icono, etiqueta de color (Creó = verde, Modificó = azul, Importó = morado), objeto ("paciente #41", "estudio #203", "pacientes" si no hay id), campos tocados y tiempo relativo en español ("hace 4 minutos"). Enlace "Ver todo".
6. **Estados:** esqueletos mientras carga; si no hay actividad, estado vacío amable con ilustración ("Todavía no hay actividad. Cuando registre algo, aparecerá aquí."); si la API falla, mensaje claro con botón "Reintentar".

### Contrato de la API (no lo cambies)
Base: variable `VITE_API_URL` (por defecto `http://localhost:3000`). Todas las rutas llevan `Authorization: Bearer <token>`.

| Ruta | Respuesta |
|---|---|
| `GET /dashboard` | Centro: `{totalPacientes, totalEstudios}` · Organismo: `{totalPacientes, totalCampanas, totalPersonasAtendidas}` |
| `GET /bitacora` | `[{id, tabla:"paciente"\|"estudio"\|"campana", registroId:number\|null, accion:"CREAR"\|"MODIFICAR"\|"IMPORTAR", detalle:{campos?:string[], filas?:number}\|null, creadoEn:ISO}]` (más reciente primero, máximo 200) |
| `GET /estudios` (centros) | `[{id, pacienteId, tipoEstudio, fecha, hora, estado, ...}]` |
| `GET /campanas` (organismos) | `[{id, nombre, area:"CARDIOVASCULAR"\|"RESPIRATORIA"\|"PLANIFICACION"\|"ONCOLOGICO_OTRO", personasAtendidas, estado, ...}]` |

La sesión se guarda como `{access_token, entidad:{id, nombre, tipo:"CENTRO_DIAGNOSTICO"\|"ORG_NO_LUCRATIVA"}}`. Crea un cliente de API tipado y un contexto de sesión reutilizables.

### Reglas
- **Privacidad:** son datos de salud; nunca pongas nombres, DPI ni teléfonos en la URL ni en el título de la pestaña, ni los registres en consola.
- **Accesibilidad (WCAG AA):** contraste suficiente, foco visible, teclado, etiquetas en los controles; el estado nunca solo por color.
- Fechas como `dd/mm/aaaa`, números con separador de miles, todo el texto de interfaz en español.

### Entrégame
El sistema de diseño (con una página interna `/diseno` que muestre colores, tipografía y componentes), el layout con menú y la pantalla de Inicio funcionando contra la API.
