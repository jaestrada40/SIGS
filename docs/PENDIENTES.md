# SISG · Nota de relevo (23 nov. 2026) — exposición el sábado 28 nov.

Para retomar en otra máquina: `git clone https://github.com/jaestrada40/SIGS.git`, abrir Claude Code en la carpeta y pedirle que lea este archivo.

## Dónde quedamos
- **Coolify (Hostinger):** la app ya corre la versión MySQL 8 en `https://sisg.kynova.tech` (API: `https://api-sisg.kynova.tech`). Entra el superadministrador. Los datos de ejemplo se cargaron con `backend/db/demo.mjs` desde la Terminal del contenedor `backend`. Usuarios y pasos: `docs/GUIA_PRESENTACION.md`, sección 2b. La contraseña de demostración está en el repositorio público: cambiarla o borrar esas cuentas después de exponer.
- **Grupo 8 (plataforma Railway, `sisg_analitica`):** nuestras 1,908 filas de `ingesta_g4_servicio` YA están cargadas en su `fact_servicio`, sin diferencias (`dw/g8/02_resultado_validacion.txt`). Hay 10 filas de prueba del Grupo 8 (establecimientos 8 a 10, 2024) que no son nuestras: confirmarlo con ellos. Su portal (repo `samarroquinh-U/SISGPlataforma`, Flask) lee nuestra vista `vw_g4_fact_servicio`; no tenemos permiso de escritura en ese repo.
- **ETL:** el nuestro es SQL (`sp_etl_completo`) y es el que se califica en Bases de Datos II. El de Python es el del Grupo 8 (su carpeta `etl/`); no hace falta reescribir el nuestro.
- **Guion:** `docs/GUION_PRESENTACION.md` tiene 13 secciones; la 9 es la integración con el Grupo 8.
- **Presentación:** `docs/PRESENTACION_SISG.html` (73 diapositivas; la 54 es la integración con el Grupo 8).

## Pendiente antes del sábado 08:00
1. **Canva:** si se presenta desde Canva y no desde el HTML, agregar a mano la diapositiva de integración con el Grupo 8.
2. **Diapositivas 71 y 72 (preguntas probables):** agregar las 3 filas sobre el Grupo 8 que ya están en el guion.
3. **Confirmar con Sharon (Grupo 8):** que las 1,908 filas están bien y de quién son las 10 filas de prueba; que el catálogo `diagnostico` aparece en su config del Grupo 4 aunque nuestra guía no lo da.
4. **Demostración:** verificar que Railway responda (`tokaido.proxy.rlwy.net:45049`) y tener una captura del tablero del Grupo 4 por si falla la red. Para ver su portal hace falta correr su repo con `.env` (usuario `usr_grupo4`).
5. **Administración de Proyectos:** entregable 3 con el capítulo de riesgos (laboratorio A1-b), formato IEEE, carátula y apéndice de declaración de uso de IA. Sin declaración, la nota máxima baja a 60%.
6. Ensayar la exposición con el guion; MFA de los usuarios de demostración ya configurado antes de exponer.

## Lo que NO está en el repositorio (llevarlo por otro medio)
- Los tres .docx de la raíz con **credenciales de Railway** de todos los grupos (`Insert datos Grupo 1 al 4.docx`, `Consumo datos Grupo 5 al 7.docx`, `de grupo 8 a todos los grupos.docx`) y la imagen de WhatsApp. No subirlos a GitHub.
- `graphify-out/` (se puede regenerar) y los archivos de Claude de esta máquina (memoria local).
