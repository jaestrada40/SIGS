# Prompt 2 para Lovable – Pantalla de Pacientes

Pégalo en Lovable **después** de tener listo el Prompt 1 (sistema de diseño, menú e Inicio).

---

## PROMPT

Sobre el sistema de diseño, el menú y la sesión que ya construiste, desarrolla ahora la pantalla **Pacientes** (`/pacientes`), reemplazando la página provisional. Debe ser accesible para centros y organismos. Mantén el mismo estilo: **cálido, con profundidad y personalidad, nada plano ni tipo Notion**. Reutiliza Card, Badge, Button, EmptyState, Skeleton y Toast; si falta algún componente, créalo en el mismo sistema de diseño. No inventes endpoints.

### Estructura de la pantalla
1. **Encabezado:** título "Pacientes", una frase ("Pacientes registrados por su entidad"), el contador total en una etiqueta y, a la derecha, los botones **Nuevo paciente** (primario), **Importar CSV** (secundario) y **Plantilla** (fantasma).
2. **Barra de búsqueda y filtros:** búsqueda por nombre o DPI (con retraso de 250 ms) y **filtros en chips** que se pueden activar y quitar: sexo (Femenino, Masculino, No especificado), estado (Activo, Inactivo) y departamento. Muestra "Limpiar filtros" cuando haya alguno activo.
3. **Lista de pacientes:**
   - **Escritorio:** tabla con filas cómodas (alto mínimo de 56 px), avatar con **iniciales y color derivado del nombre**, nombre, DPI, sexo (etiqueta de color), fecha de nacimiento con la edad ("14/03/1988 · 38 años"), residencia ("Mixco, Guatemala"), teléfono y estado (etiqueta). Cabecera fija, orden por columna y filas que se **resaltan al pasar el cursor**.
   - **Celular:** cada paciente como **tarjeta** con avatar, nombre, etiquetas y acciones; sin scroll horizontal.
   - Paginación o carga progresiva de 25 en 25.
4. **Panel lateral (drawer)** al hacer clic en un paciente: encabezado con avatar grande, nombre y etiquetas; datos en secciones (Identificación, Contacto, Residencia); botón **Editar** que cambia a formulario con los mismos campos; **Guardar cambios** con confirmación mediante toast. Cierra con Escape o tocando fuera.
5. **Formulario "Nuevo paciente"** en un drawer o diálogo: campos agrupados, validación en línea, campos obligatorios marcados y botón deshabilitado hasta que sea válido.
6. **Importar CSV:** diálogo con **zona de arrastrar y soltar** (también botón "Elegir archivo"), enlace a la plantilla, **vista previa** de las primeras 5 filas y botón "Importar N filas". Al terminar, toast de éxito con el número de filas y la lista se actualiza. Si la API rechaza el archivo, muestra una **lista de errores por fila** ("Fila 3: sexo debe ser F, M o NE") con aviso claro de que **no se importó nada**, y permite corregir y volver a subir.
7. **Estados:** esqueletos al cargar; si no hay pacientes, **estado vacío** con ilustración y dos botones (Nuevo paciente / Importar CSV); si hay búsqueda sin resultados, mensaje "No encontramos pacientes con esos filtros" y "Limpiar filtros"; si la API falla, mensaje con "Reintentar".

### Detalles de comportamiento
- **Plantilla CSV:** se genera en el navegador con las columnas `nombreCompleto, sexo, dpi, fechaNacimiento, departamento, municipio, telefono, contactoEmergencia, estado` y una fila de ejemplo.
- **Lectura del CSV:** acepta coma o punto y coma, comillas y BOM; las celdas vacías se omiten; las fechas `dd/mm/aaaa` se convierten a `aaaa-mm-dd` antes de enviar; rechaza columnas desconocidas con un mensaje que liste las válidas.
- **Edad:** se calcula en el cliente; si no hay fecha de nacimiento, muestra "—".
- **Privacidad:** no pongas nombres ni DPI en la URL, el título de la pestaña ni la consola. Al abrir un paciente, la URL usa solo el id (`/pacientes/41`).
- **Accesibilidad:** tabla con encabezados correctos, foco visible, drawer con foco atrapado y regreso del foco al cerrar, etiquetas en todos los campos y estado nunca solo por color.

### Contrato de la API (no lo cambies)
Base `VITE_API_URL`; todas las rutas llevan `Authorization: Bearer <token>`; un 401 cierra la sesión. Los errores de validación llegan como `{message: string | string[]}`.

| Método y ruta | Cuerpo / respuesta |
|---|---|
| `GET /pacientes` | `[{id, nombreCompleto, sexo:"F"\|"M"\|"NE", dpi, fechaNacimiento:"aaaa-mm-dd", departamento, municipio, telefono, contactoEmergencia, estado}]` (solo los de la entidad; el filtrado y la búsqueda se hacen en el cliente) |
| `POST /pacientes` | Campos del paciente; obligatorios `nombreCompleto` y `sexo`. Devuelve el paciente creado |
| `GET /pacientes/:id` | Un paciente (404 si no es de su entidad) |
| `PATCH /pacientes/:id` | Solo los campos que cambian. Devuelve el paciente actualizado |
| `POST /pacientes/importar` | `{filas:[{...campos del paciente}]}` → `{importados}`. Máximo 1,000 filas. Si alguna falla: `400 {message, errores:[{fila, mensaje}]}` y **no importa nada** (fila 1 = encabezado, la primera de datos es la 2) |

### Entrégame
La pantalla completa funcionando contra la API, con los estados vacío, de carga, de error y de importación con errores. Al final, dime qué componentes nuevos agregaste al sistema de diseño.
