#!/usr/bin/env python3
"""Arma el documento único «Proyecto final» del Grupo 4 (estructura como la del Grupo 8):
carátula, índice, 1 Alcance, 2 Administración de proyectos, 3 Bases de datos, 4 Bibliografía,
5 Declaración de IA y 6 Anexos. Todo sale de los .md de docs/gestion y del script entrega_bd2/build_entregable.py.
Uso (desde cualquier carpeta):  py entrega_final/build_proyecto_final.py      (necesita python-docx)"""
import os, re
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
GEST = os.path.join(RAIZ, "docs", "gestion")
BD = os.path.join(RAIZ, "entrega_bd2")
FIG = os.path.join(GEST, "generador", "figuras")
OUT = os.path.join(AQUI, "Proyecto_Final_SISG_Grupo4.docx")
MIEMBROS = ["Javier Augusto Estrada Gordillo", "Jonathan Eduardo Jolón García", "Jonathan Javier Soberanis Castillo"]
DOCENTES = ["Ing. Rafael German Barrios Parra (Docente)", "Ingeniera. Claudia Guisela Alegre Recinos (Docente)"]

doc = Document()
for s in doc.sections:
    s.page_width, s.page_height = Cm(21.59), Cm(27.94)
    s.left_margin = s.right_margin = Cm(2.5); s.top_margin = s.bottom_margin = Cm(2.3)
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10.5)
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
for n, sz in ((1, 16), (2, 13), (3, 11.5), (4, 10.5)):
    h = doc.styles[f"Heading {n}"]; h.font.name = "Calibri"; h.font.size = Pt(sz); h.font.bold = True
    h.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F); h.element.rPr.rFonts.set(qn("w:asciiTheme"), "minorHAnsi") if False else None

# ---------- helpers (los mismos nombres que usa build_entregable.py, que se ejecuta más abajo sobre este mismo doc)
def shade(cell, hexc):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement("w:shd"); sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), hexc); tcPr.append(sh)

def runs(p, text, size=None, bold=False, italic=False):
    """**negrita**, *cursiva* y `código` dentro de un párrafo."""
    for t in re.split(r"(\*\*.+?\*\*|`[^`]+`|\*[^*\s][^*]*?\*)", text):
        if not t: continue
        b, i, c = bold, italic, False
        if t.startswith("**") and t.endswith("**") and len(t) > 4: t, b = t[2:-2], True
        elif t.startswith("`") and t.endswith("`") and len(t) > 2: t, c = t[1:-1], True
        elif t.startswith("*") and t.endswith("*") and len(t) > 2: t, i = t[1:-1], True
        r = p.add_run(t); r.bold = b; r.italic = i
        if size: r.font.size = Pt(size)
        if c: r.font.name = "Consolas"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas"); r.font.size = Pt((size or 10.5) - 1)

def para(t, bold=False, italic=False, size=None, align=None, style=None):
    p = doc.add_paragraph(style=style)
    if align is not None: p.alignment = align
    if bold or italic or size: r = p.add_run(t); r.bold = bold; r.italic = italic; r.font.size = Pt(size) if size else None
    else: runs(p, t)
    return p

def table(rows, widths=None, size=9):
    ncol = max(len(r) for r in rows)
    t = doc.add_table(rows=len(rows), cols=ncol); t.style = "Table Grid"
    for i, row in enumerate(rows):
        for j in range(ncol):
            c = t.cell(i, j); c.text = ""; p = c.paragraphs[0]
            runs(p, row[j] if j < len(row) else "", size=size, bold=(i == 0))
            if i == 0: shade(c, "D9E2F3")
    if widths and len(widths) == ncol:
        for row in t.rows:
            for j, w in enumerate(widths): row.cells[j].width = Cm(w)
    doc.add_paragraph()

def img(path, w=16, caption=None):
    doc.add_picture(path, width=Cm(w)); doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption: para(caption, italic=True, size=9, align=WD_ALIGN_PARAGRAPH.CENTER)

def salto(): doc.add_page_break()

def campo(p, instr, texto=""):
    """Campo de Word (TOC, PAGE...). Word lo calcula al abrir."""
    for t, extra in (("begin", None), (None, instr), ("separate", None), (None, texto), ("end", None)):
        r = p.add_run()
        if t:
            f = OxmlElement("w:fldChar"); f.set(qn("w:fldCharType"), t); r._r.append(f)
        elif extra is instr:
            it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = instr; r._r.append(it)
        else: r.text = texto

# ---------- markdown -> docx
def md_leer(nombre):
    return open(os.path.join(GEST, nombre), encoding="utf8").read().replace("\r\n", "\n").split("\n")

def md_render(lineas, nivel_base, prefijo=None, omitir_titulo=True):
    """## -> nivel_base, ### -> nivel_base+1, #### -> nivel_base+2. Devuelve las líneas de 'Referencias' para la bibliografía."""
    refs, en_refs, fila, i = [], False, [], 0
    cont = [0, 0, 0]   # contadores de ##, ### y ####
    def vaciar():
        nonlocal fila
        if fila:
            filas = [r for r in fila if not all(re.fullmatch(r":?-{2,}:?", c) for c in r)]
            if filas: table(filas, size=8.5)
            fila = []
    buf, cerca = [], None
    def fin():
        nonlocal buf
        if buf: p = doc.add_paragraph(); runs(p, " ".join(buf)); buf = []
    for ln in lineas:
        s = ln.rstrip()
        if s.startswith("```"):
            fin(); vaciar()
            cerca = None if cerca is not None else (s[3:].strip() or "texto"); continue
        if cerca is not None:
            if cerca != "mermaid" and s.strip():   # los diagramas mermaid van como figura en el Anexo A
                p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(0); r = p.add_run(s); r.font.name = "Consolas"; r.font.size = Pt(8)
            continue
        if re.match(r"^#{1,4} ", s):
            fin(); vaciar()
            n = len(s) - len(s.lstrip("#")); txt = s[n:].strip()
            if n == 1:
                if omitir_titulo: continue
            if n == 2: en_refs = txt.lower().startswith("referencias")
            if en_refs and n == 2: continue
            txt = txt.replace("*", "").replace("`", "")
            if prefijo and n >= 2:
                cont[n - 2] += 1
                for k in range(n - 1, 3): cont[k] = 0
                txt = prefijo + "." + ".".join(str(c) for c in cont[:n - 1]) + " " + re.sub(r"^(\d+(\.\d+)*\.?|[A-Z]\.\d+)\s+", "", txt)
            doc.add_heading(txt, min(max(nivel_base + n - 2, 1), 4)); continue
        if en_refs:
            if s.strip(): refs.append(s.strip())
            continue
        if s.startswith("|"):
            fin(); fila.append([c.strip() for c in s.strip().strip("|").split("|")]); continue
        vaciar()
        if not s.strip() or s.strip() in ("---", "***"): fin(); continue
        if s.startswith(">"): fin(); p = doc.add_paragraph(); runs(p, s.lstrip("> ").strip(), italic=True); continue
        m = re.match(r"^(\s*)[-*] (.*)", s)
        if m: fin(); p = doc.add_paragraph(style="List Bullet"); runs(p, m.group(2)); p.paragraph_format.left_indent = Cm(0.63 + 0.6 * (len(m.group(1)) // 2)); continue
        m = re.match(r"^(\s*)(\d+[.)]) (.*)", s)
        if m: fin(); p = doc.add_paragraph(); p.paragraph_format.left_indent = Cm(0.9); p.paragraph_format.first_line_indent = Cm(-0.6); runs(p, f"{m.group(2)} {m.group(3)}"); continue
        buf.append(s.strip())
    fin()
    vaciar()
    return refs

def md_desde(lineas, marca):
    """Líneas posteriores a la primera que empieza por `marca` (para saltarse el encabezado del archivo)."""
    for k, ln in enumerate(lineas):
        if ln.startswith(marca): return lineas[k:]
    return lineas

# ================= carátula
def centro(t, size, bold=False, before=0, after=6):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(t); r.bold = bold; r.font.size = Pt(size)
    p.paragraph_format.space_before = Pt(before); p.paragraph_format.space_after = Pt(after)
centro("UNIVERSIDAD SAN PABLO DE GUATEMALA", 16, True, 40)
centro("Campus Central", 12); centro("Facultad de Ingeniería", 12); centro("Licenciatura en Ingeniería en Sistemas", 12)
centro("Proyecto final – SISG, módulo del Grupo 4", 22, True, 110, 4)
centro("Centros de diagnóstico y organizaciones no lucrativas", 14, False, 0, 4)
centro("Grupo # 4", 14, True, 0, 40)
for m in MIEMBROS: centro(m, 12, False, 0, 2)
centro("[carné de cada integrante: pendiente]", 9, False, 4, 40)
for d in DOCENTES: centro(d, 11, False, 0, 2)
centro("Guatemala, noviembre de 2026", 12, False, 40)
salto()

# ================= índice
doc.add_heading("Índice", 1)
campo(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u', "Haga clic derecho aquí y elija «Actualizar campo» para generar el índice.")
salto()

# ================= 1. Alcance
doc.add_heading("1. Alcance del proyecto", 1)
bib = []
bib += md_render(md_desde(md_leer("01_acta_y_alcance.md"), "## Parte A"), 2, "1")
salto()

# ================= 2. Administración de proyectos
doc.add_heading("2. Administración de proyectos tecnológicos", 1)
for n, (archivo, titulo) in enumerate((("02_edt_cronograma_costos.md", "EDT, cronograma y costos"),
                                       ("03_interesados_comunicaciones.md", "Interesados y comunicaciones"),
                                       ("04_riesgos_calidad.md", "Riesgos y calidad")), 1):
    doc.add_heading(f"2.{n} {titulo}", 2)
    bib += md_render(md_desde(md_leer(archivo), "## "), 3, f"2.{n}")
salto()

# ================= 3. Bases de datos (se reutiliza build_entregable.py sobre este mismo documento)
doc.add_heading("3. Arquitectura de base de datos (Bases de Datos II)", 1)
src = open(os.path.join(BD, "build_entregable.py"), encoding="utf8").read()
src = re.sub(r"^miembros = .*$", "miembros = ''", src, flags=re.M)
src = src.replace("doc = Document()", "doc = DOC")
a, b = src.index("# ---------------- portada"), src.index("# ---------------- 1. ER fuentes")
src = src[:a] + src[b:]
src = re.sub(r"doc\.save\(.*\n?$", "", src.rstrip() + "\n")
src = src.replace("doc.add_heading(", "HEAD(")
vistos = {"n": 0}
def HEAD(texto, nivel):
    m = re.match(r"^(\d)\.(\d) (.*)", texto); k = re.match(r"^(\d)\. (.*)", texto)
    if nivel == 1 and k: doc.add_heading(f"3.{int(k.group(1))} {k.group(2)}", 2)          # «1. Modelo…» -> «3.1 Modelo…»
    elif nivel == 2 and m: doc.add_heading(f"3.{int(m.group(1))}.{int(m.group(2))} {m.group(3)}", 3)   # «2.1 …» -> «3.2.1 …»
    else: doc.add_heading(texto, min(nivel + 1, 4))
ns = {"__file__": os.path.join(BD, "build_entregable.py"), "DOC": doc, "HEAD": HEAD}
exec(compile(src, "build_entregable.py", "exec"), ns)
doc.add_page_break()

# ================= 4. Bibliografía
doc.add_heading("4. Bibliografía", 1)
vistas = set()
for r in bib:
    clave = re.sub(r"\W+", "", r.lower())[:80]
    if clave in vistas: continue
    vistas.add(clave); p = doc.add_paragraph(); p.paragraph_format.left_indent = Cm(0.9); p.paragraph_format.first_line_indent = Cm(-0.9); runs(p, r)
if not bib: para("(sin referencias)")
salto()

# ================= 5. Declaración de IA
doc.add_heading("5. Declaración de uso de inteligencia artificial", 1)
md_render(md_leer("05_apendice_declaracion_ia.md"), 2, "5")
salto()

# ================= 6. Anexos
doc.add_heading("6. Anexos", 1)
doc.add_heading("Anexo A. Figuras de gestión del proyecto", 2)
for f, t in (("edt.png", "Figura A1. Estructura de desglose del trabajo (EDT)."), ("pdm.png", "Figura A2. Diagrama de precedencia (PDM) y ruta crítica."),
             ("gantt.png", "Figura A3. Cronograma (Gantt)."), ("poder.png", "Figura A4. Matriz poder / interés de los interesados.")):
    if os.path.exists(os.path.join(FIG, f)): img(os.path.join(FIG, f), 16, t)
doc.add_heading("Anexo B. Guion de la prueba de usabilidad", 2)
md_render(md_leer("06_prueba_usabilidad.md"), 3)

# ---------- pie con número de página e índice que Word actualiza al abrir
for s in doc.sections:
    p = s.footer.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER; campo(p, "PAGE", "1")
ajustes = doc.settings.element; uf = OxmlElement("w:updateFields"); uf.set(qn("w:val"), "true"); ajustes.append(uf)
doc.save(OUT); print("listo", OUT)
