# Diseño de Lovable extraído de los archivos públicos (sin iniciar sesión)

Fuente: https://pixel-perfect-replay-4625.lovable.app/ (CSS y JavaScript públicos). Pendiente: aplicarlo a las páginas internas de la app (el login se queda como está).

## Tokens (OKLCH)
- radio: 1rem · fondo `oklch(98% .008 170)` · texto `oklch(26% .05 245)` · tarjeta blanca
- primario `oklch(53% .1 175)` · primario brillante `oklch(71% .13 180)` · borde `oklch(91% .015 175)` · input `oklch(89% .02 175)`
- acentos: ámbar `oklch(79% .16 75)` · coral `oklch(72% .17 30)` · azul cielo `oklch(62% .19 260)` · uva `oklch(52% .2 300)`
- degradado de bienvenida: `linear-gradient(125deg, oklch(45% .09 180) 0%, var(--primary) 45%, var(--primary-glow) 100%)`
- degradado de página: dos radiales (verde azulado arriba a la derecha, ámbar suave abajo a la izquierda)
- sombras: `card` (borde interior blanco + 2 capas suaves), `lift` (al pasar el cursor), `glow` (botones/bienvenida)
- fuentes: Inter (cuerpo) y Plus Jakarta Sans 600/700/800 (títulos); patrón de textil (`bg-textile`) sobre la tarjeta de bienvenida
- modo oscuro con las mismas variables

## Estructura del Inicio (leída del código)
1. Tarjeta de bienvenida (`rounded-3xl`, degradado, patrón textil, ilustración a la derecha): etiqueta del tipo de entidad, saludo según la hora + nombre, frase por rol y botón "Nuevo paciente".
2. Resumen: tarjetas con icono en chip de color y minigráfica (Pacientes = verde azulado, Estudios = azul, Campañas = coral, Personas atendidas = ámbar).
3. Acciones rápidas (4 mosaicos "surface lift"): Nuevo paciente, Nuevo estudio/Nueva campaña, Importar CSV, Ver actividad.
4. Gráfica de área (3/5 del ancho): "Estudios por mes" (centro, últimos 6 meses) o "Personas atendidas por área" (organismo); + Actividad reciente (2/5): línea de tiempo vertical con icono, etiqueta (Creó=verde azulado, Modificó=azul, Importó=uva), objeto, campos y hora.
5. Estados: esqueleto con brillo, error con "Reintentar", vacío "Todavía no hay actividad".
