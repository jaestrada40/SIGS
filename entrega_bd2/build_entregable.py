#!/usr/bin/env python3
"""Arma el entregable de Bases de Datos II (Word) con el contenido real de dw/ : ER de la fuente, modelo estrella, ETL y consultas.
Uso: python3 build_entregable.py    (necesita python-docx e img/*.png)"""
import os, re, json
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

H = os.path.dirname(os.path.abspath(__file__)); DW = os.path.join(H, "..", "dw")
rd = lambda *p: open(os.path.join(DW, *p), encoding="utf8").read()
miembros = json.loads(re.search(r"window\.APT = (.*);\s*$", open(os.path.join(H, "..", "..", "SISG-APT", "data", "apt.js"), encoding="utf8").read(), re.S).group(1))["miembros"]

doc = Document()
for s in doc.sections: s.left_margin = s.right_margin = Cm(2); s.top_margin = s.bottom_margin = Cm(2)
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10.5)
def shade(cell, hexc):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement("w:shd"); sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), hexc); tcPr.append(sh)
def para(t, bold=False, italic=False, size=None, align=None):
    p = doc.add_paragraph(); r = p.add_run(t); r.bold = bold; r.italic = italic
    if size: r.font.size = Pt(size)
    if align: p.alignment = align
    return p
def code(t):
    for ln in t.strip("\n").split("\n"):
        p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(0); p.paragraph_format.space_before = Pt(0)
        r = p.add_run(ln if ln else " "); r.font.name = "Consolas"; r.font.size = Pt(8); r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
    doc.add_paragraph()
def table(rows, widths=None, size=9):
    t = doc.add_table(rows=len(rows), cols=len(rows[0])); t.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, v in enumerate(row):
            c = t.cell(i, j); c.text = ""; r = c.paragraphs[0].add_run(re.sub(r"[*`]", "", v)); r.font.size = Pt(size)
            if i == 0: r.bold = True; shade(c, "D9E2F3")
    if widths:
        for row in t.rows:
            for j, w in enumerate(widths): row.cells[j].width = Cm(w)
    doc.add_paragraph()
def mdtable(md, marker):
    seg = md[md.index(marker):].split("\n")[1:]; rows = []; on = False
    for ln in seg:
        if ln.strip().startswith("|"):
            on = True; cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells): rows.append(cells)
        elif on: break
    return rows
def img(name, w=17): doc.add_picture(os.path.join(H, "img", name), width=Cm(w)); doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
def blocks(sql):
    """separa un script en (comentario, sentencia) usando las líneas '-- n.' como títulos"""
    return sql

# ---------------- portada
para("\n\nSISG · Sistema Integral de Salud de Guatemala", bold=True, size=22, align=WD_ALIGN_PARAGRAPH.CENTER)
para("Entregable de Bases de Datos II", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER)
para("Grupo 4 · centros de diagnóstico y organismos no lucrativos", size=12, align=WD_ALIGN_PARAGRAPH.CENTER)
para("\n" + miembros, size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
para("\nContenido:\n1. Modelo Entidad-Relación de las fuentes\n2. Modelo estrella de análisis\n3. Procesos de transformación (ETL)\n4. Queries utilizados para consultas", size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
para("\nDeclaración de uso de IA: ver el apéndice del proyecto (docs/gestion/05_apendice_declaracion_ia.md). Los datos son sintéticos.", italic=True, size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
doc.add_page_break()

# ---------------- 1. ER fuentes
doc.add_heading("1. Modelo Entidad-Relación de las fuentes", 1)
para("Las fuentes son las bases operativas (OLTP) de los centros de diagnóstico y de los organismos no lucrativos. El modelo parte de la aplicación SISG (entidad, paciente, estudio, campaña) y lo lleva a tercera forma normal: catálogos en lugar de texto libre (departamento, municipio, tipo de estudio, área), llaves foráneas, únicos, CHECK e índices, y columnas pensadas para medir (costo_q, duracion_min, presupuesto_q). La base se llama sisg_fuente.")
img("er_fuente.png", 16.5)
doc.add_heading("Descripción de las tablas", 2)
table([["Tabla", "Qué guarda", "Llaves principales"],
 ["departamento", "Catálogo de departamentos", "PK id; nombre único"],
 ["municipio", "Catálogo de municipios", "PK id; FK departamento_id; único (departamento, nombre)"],
 ["tipo_entidad", "Centro de diagnóstico u organismo no lucrativo", "PK id; nombre único"],
 ["entidad", "Cada centro u organismo que usa SISG", "PK id; FK tipo_entidad_id, departamento_id; correo único"],
 ["paciente", "Pacientes de cada entidad (el DPI es único por entidad)", "PK id; FK entidad_id, departamento_id, municipio_id"],
 ["tipo_estudio", "Catálogo de estudios con categoría, precio base y duración base", "PK id; nombre único"],
 ["estudio", "Cada estudio diagnóstico (fecha, estado, duración, costo)", "PK id; FK entidad_id, paciente_id, tipo_estudio_id; CHECK costo_q ≥ 0"],
 ["area_campana", "Catálogo de áreas de campaña", "PK id; nombre único"],
 ["campana", "Campañas de salud (fechas, personas atendidas, presupuesto)", "PK id; FK entidad_id, area_id, departamento_id, municipio_id; CHECK fecha_fin ≥ fecha_inicio"],
 ["bitacora", "Auditoría: la llenan los triggers (INSERT/UPDATE/DELETE)", "PK id; índice (tabla, registro_id)"]], [3, 7, 7])
doc.add_heading("Script de creación (sql/01_fuente_esquema.sql)", 2)
code(rd("sql", "01_fuente_esquema.sql"))
doc.add_page_break()

# ---------------- 2. Estrella
dis = rd("DISENO_ESTRELLA.md")
doc.add_heading("2. Modelo estrella de análisis", 1)
para("El almacén de datos sisg_dw responde preguntas de negocio sin competir con quien registra pacientes. Tiene dos hechos (estudios y campañas) y siete dimensiones, tres de ellas conformadas (tiempo, geografía y entidad).")
doc.add_heading("2.1 Procesos de negocio y preguntas", 2); table(mdtable(dis, "## 1. Procesos"), [3.5, 8, 3.5])
doc.add_heading("2.2 Granos y medidas", 2); table(mdtable(dis, "## 2. Granos"), [3, 5, 3.5, 5.5])
doc.add_heading("2.3 Matriz de dimensiones conformadas", 2); table(mdtable(dis, "## 3. Matriz"), [4, 3.5, 4, 3.5])
doc.add_heading("2.4 Diccionario de dimensiones", 2); table(mdtable(dis, "## 4. Diccionario"), [2.8, 2.6, 4.2, 3.2, 4.2], 8.5)
doc.add_heading("2.5 Diagrama", 2); img("estrella.png", 17)
doc.add_heading("2.6 ¿Estrella o copo de nieve?", 2)
para("Decisión: estrella.", bold=True); table(mdtable(dis, "## 6. ¿Estrella"), [3.5, 9.5, 3], 8.5)
doc.add_heading("2.7 Tabla de sumarización", 2)
para("fact_estudio_mensual guarda estudios realizados, ingresos y duración promedio por mes, centro y tipo de estudio (≈ 1,800 filas frente a ≈ 12,000 del hecho). Se pierde la geografía a propósito: con ella la tabla casi no se reducía (10,106 filas contra 12,219 en la primera prueba). Las consultas 1 y 8 responden la misma pregunta; se comparan con EXPLAIN.")
doc.add_heading("2.8 Decisiones de diseño y límites", 2)
for t in ["Cambios en las dimensiones (SCD): tipo 1 (sobrescribir); el ETL recarga todo, por eso no se conserva historia. Para historia habría que pasar a tipo 2.",
          "La dimensión de tiempo cumple dos roles en fact_campana (inicio y fin), sin duplicar la tabla.",
          "Valores desconocidos (-1) para no perder hechos cuando falta un lugar o una fecha de nacimiento.",
          "Costo y duración son medidas reales en los datos sintéticos; con datos de la aplicación son valores de lista del catálogo, porque la aplicación aún no los registra.",
          "Privacidad: el almacén no contiene nombre, DPI, teléfono ni contacto; solo sexo y grupo de edad."]:
    doc.add_paragraph(t, style="List Bullet")
doc.add_heading("Script de creación (sql/04_dw_esquema.sql y 04b_dw_vistas.sql)", 2)
code(rd("sql", "04_dw_esquema.sql")); code(rd("sql", "04b_dw_vistas.sql"))
doc.add_page_break()

# ---------------- 3. ETL
doc.add_heading("3. Procesos de transformación (ETL)", 1)
para("El ETL lleva los datos de sisg_fuente a sisg_dw con el procedimiento CALL sp_etl_completo(). Es una recarga completa (borra y vuelve a cargar), suficiente para el volumen del proyecto; para producción se usaría carga incremental con marca de agua en etl_log.")
table([["Paso", "Procedimiento", "Qué hace"],
 ["0", "sp_etl_completo", "Registra el inicio en etl_log, llama a los pasos siguientes y deja OK o ERROR con el mensaje"],
 ["1", "sp_cargar_dim_tiempo", "Genera un renglón por día (2024-2027) con año, trimestre, mes, nombre del mes y fin de semana"],
 ["2", "sp_etl_dimensiones", "Vacía y carga geografía (con la fila -1 «Desconocido»), entidad, paciente (solo sexo), tipo de estudio y área"],
 ["3", "sp_etl_facts", "Carga fact_estudio y fact_campana: busca las llaves de cada dimensión, calcula el grupo de edad al día del estudio y usa -1 si falta lugar o fecha"],
 ["4", "sp_etl_resumen", "Carga fact_estudio_mensual con los estudios REALIZADOS agrupados por mes, centro y tipo"]], [1.3, 4.2, 11.5])
doc.add_heading("Transformaciones aplicadas", 2)
for t in ["Llaves sustitutas: cada dimensión tiene su propia llave (entidad_key, geo_key…) distinta de la de la fuente.",
          "Fecha → tiempo_key con formato yyyymmdd.",
          "Edad → grupo etario (0-14, 15-29, 30-44, 45-59, 60+) calculado con TIMESTAMPDIFF a la fecha del estudio.",
          "Municipio o departamento faltante → geografía del departamento sin municipio, o -1 si no hay ninguno.",
          "Datos personales (nombre, DPI, teléfono) no se cargan al almacén.",
          "Campañas: duración en días = fecha_fin − fecha_inicio + 1."]:
    doc.add_paragraph(t, style="List Bullet")
doc.add_heading("Código del ETL (sql/05_dw_etl.sql)", 2); code(rd("sql", "05_dw_etl.sql"))
doc.add_heading("Verificación: reconciliación fuente ↔ almacén (sql/07_reconciliacion.sql)", 2)
para("Después de cada carga se comparan filas y montos entre la fuente y el almacén; la diferencia debe ser 0.")
code(rd("sql", "07_reconciliacion.sql"))
doc.add_page_break()

# ---------------- 4. Queries
doc.add_heading("4. Queries utilizados para consultas", 1)
para("Ocho consultas analíticas sobre el modelo estrella (se ejecutan después de CALL sp_etl_completo();), más el plan de ejecución que compara la consulta 1 con la 8. Archivo: sql/06_consultas.sql.")
q = rd("sql", "06_consultas.sql"); body = q.split("USE sisg_dw;")[1]
parts = re.split(r"\n(?=-- \d+\. )", body.strip("\n"))
for p in parts:
    p = p.strip("\n"); m = re.match(r"-- (\d+)\. (.*?)\n(.*)", p, re.S)
    if not m: continue
    n, t, rest = m.group(1), m.group(2), m.group(3)
    # los comentarios que continúan el título (líneas -- sin número) pasan al texto
    cont = re.findall(r"^--\s*(.*)$", rest, re.M); rest = re.sub(r"^--.*\n", "", rest, flags=re.M)
    doc.add_heading(f"Consulta {n}", 2); para((t + " " + " ".join(cont)).strip()); code(rest)
doc.save(os.path.join(H, "Entregable_BD2_SISG_Grupo4.docx")); print("listo")
