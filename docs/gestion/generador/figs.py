import json, html
from datetime import date, timedelta
P = json.load(open('plan.json')); R = {r['id']: r for r in P['red']}
FONT = "font-family:'Times New Roman',Times,serif"
esc = html.escape
SHORT = {"A":"Validar acta, alcance y EDT","B":"Diseño estrella (30 oct.)","C":"ETL con datos reales","D":"Consultas y EXPLAIN","E":"Documento técnico BD II","F":"Riesgos y calidad",
         "G":"Comunicaciones y reportes","H":"Informe de cierre","I":"Preparar exposición","J":"Exposición final","K":"Revisión por pares","L":"Ajustes y entrega BD II"}
BLUE, GREEN, RED, ORANGE = "#2f5f8f", "#3a7d5a", "#a8322d", "#c77d1a"

def txt(x, y, s, size=13, anchor="start", weight="normal", fill="#111", style=""):
    return f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" style="{FONT};{style}">{esc(s)}</text>'

# ---------- Gantt ----------
def gantt():
    S0 = date(2026, 10, 26); days = 37; W = 1400; L = 300; X0 = L + 20; PX = (W - X0 - 20) / days
    rows = [("Bases de Datos II", None)] + [(i, R[i]) for i in "BCDEKL"] + [("Administración de Proyectos", None)] + [(i, R[i]) for i in "AFGHIJ"]
    top = 70; rh = 32; H = top + rh * len(rows) + 100
    x = lambda d: X0 + d * PX
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#fff"/>']
    o.append(txt(W / 2, 28, "Cronograma de las actividades restantes (días calendario)", 20, "middle", "bold"))
    # exposición (semana 19) y fecha límite
    ex0, ex1 = (date(2026, 11, 20) - S0).days, (date(2026, 11, 22) - S0).days
    o.append(f'<rect x="{x(ex0)}" y="{top - 8}" width="{(ex1 - ex0) * PX}" height="{rh * len(rows) + 8}" fill="#fbe9d0"/>')
    for d in range(days + 1):
        dd = S0 + timedelta(days=d); mon = dd.weekday() == 0
        o.append(f'<line x1="{x(d)}" y1="{top - 8}" x2="{x(d)}" y2="{top + rh * len(rows)}" stroke="{"#888" if mon else "#e3e3e3"}" stroke-width="{1.2 if mon else 1}"/>')
        if mon: o.append(txt(x(d) + 3, top - 14, f"{dd.day} {['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][dd.month]}", 13, "start", "normal", "#333"))
    for n, (k, r) in enumerate(rows):
        y = top + n * rh
        if r is None:
            o.append(f'<rect x="10" y="{y + 3}" width="{L - 10}" height="{rh - 6}" fill="#eef1f5"/>' + txt(16, y + rh / 2 + 5, k, 14, "start", "bold")); continue
        col = RED if k in "KL" else ORANGE if k == "J" else BLUE if k in "BCDE" else GREEN
        o.append(txt(L - 8, y + rh / 2 + 5, f"{k}. {SHORT[k]}", 14, "end"))
        if r['holgura']: o.append(f'<rect x="{x(r["EF"])}" y="{y + 9}" width="{r["holgura"] * PX}" height="{rh - 18}" fill="none" stroke="{col}" stroke-dasharray="4 3"/>')
        o.append(f'<rect x="{x(r["ES"])}" y="{y + 6}" width="{r["dur"] * PX}" height="{rh - 12}" rx="3" fill="{col}"/>')
        o.append(txt(x(r["ES"]) + r["dur"] * PX / 2, y + rh / 2 + 5, f'{r["dur"]} d', 12, "middle", "normal", "#fff"))
    ye = top + rh * len(rows)
    dl = (date(2026, 11, 28) - S0).days + 8 / 24
    o.append(f'<line x1="{x(dl)}" y1="{top - 8}" x2="{x(dl)}" y2="{ye + 4}" stroke="{RED}" stroke-width="2.5"/>' + txt(x(dl) - 6, ye + 46, "Entrega BD II: 28 nov., 8:00", 14, "end", "bold", RED))
    o.append(txt(x(ex1), ye + 24, "Exposición (sem. 19)", 13, "end", "bold", ORANGE))
    o.append(f'<rect x="{X0}" y="{ye + 68}" width="22" height="12" fill="{BLUE}"/>' + txt(X0 + 28, ye + 79, "Bases de Datos II", 13)
             + f'<rect x="{X0 + 160}" y="{ye + 68}" width="22" height="12" fill="{GREEN}"/>' + txt(X0 + 188, ye + 79, "Administración de Proyectos", 13)
             + f'<rect x="{X0 + 380}" y="{ye + 68}" width="22" height="12" fill="{RED}"/>' + txt(X0 + 408, ye + 79, "Cierre de BD II (con 2 d de holgura)", 13)
             + f'<rect x="{X0 + 640}" y="{ye + 68}" width="22" height="12" fill="none" stroke="#555" stroke-dasharray="4 3"/>' + txt(X0 + 668, ye + 79, "Holgura", 13))
    o.append('</svg>'); return "".join(o)

# ---------- Red PDM ----------
def pdm():
    BW, BH, GX, GY = 190, 70, 50, 34
    pos = {"B": (0, 0), "C": (1, 0), "D": (2, 0), "E": (3, 0), "K": (4, 0), "L": (5, 0), "A": (0, 2), "F": (1, 1.5), "G": (1, 2.5), "H": (2, 2), "I": (3, 2), "J": (4, 2)}
    W = 6 * BW + 5 * GX + 40; H = int(3.5 * (BH + GY)) + 90
    px = lambda i: 20 + pos[i][0] * (BW + GX); py = lambda i: 55 + pos[i][1] * (BH + GY)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#fff"/>',
         '<defs><marker id="a" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#444"/></marker></defs>',
         txt(W / 2, 28, "Diagrama de red (método de diagramación por precedencia)", 20, "middle", "bold")]
    for r in P['red']:
        for p in r['pred'].split(','):
            if p == '—': continue
            a, lag = p.split('(')[0], p
            x1, y1 = px(a) + BW, py(a) + BH / 2; x2, y2 = px(r['id']), py(r['id']) + BH / 2
            o.append(f'<path d="M{x1},{y1} C{x1 + 28},{y1} {x2 - 28},{y2} {x2},{y2}" fill="none" stroke="#444" stroke-width="1.6" marker-end="url(#a)"/>')
    for i in pos:
        r = R[i]; col = RED if i in "KL" else ORANGE if i == "J" else BLUE if i in "BCDE" else GREEN
        o.append(f'<rect x="{px(i)}" y="{py(i)}" width="{BW}" height="{BH}" rx="6" fill="#fff" stroke="{col}" stroke-width="2.2"/>'
                 f'<rect x="{px(i)}" y="{py(i)}" width="{BW}" height="24" rx="6" fill="{col}"/>')
        o.append(txt(px(i) + 8, py(i) + 17, f"{i}. {SHORT[i]}", 13, "start", "bold", "#fff"))
        o.append(txt(px(i) + 8, py(i) + 43, f"Duración {r['dur']} d · holgura {r['holgura']} d", 13))
        o.append(txt(px(i) + 8, py(i) + 61, f"{r['inicio'][8:]}/{r['inicio'][5:7]} – {r['fin'][8:]}/{r['fin'][5:7]}" + (" · solapa 2 d con E" if i == "K" else ""), 12, "start", "normal", "#555"))
    o.append('</svg>'); return "".join(o)

# ---------- Matriz poder / interés ----------
def poder():
    ST = json.load(open('stake.json'))
    S = 640; M = 70; G = S - 2 * M
    pt = lambda p, i: (M + (i - 0.5) / 5 * G, M + (1 - (p - 0.5) / 5) * G)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{S + 360}" height="{S + 50}" viewBox="0 0 {S + 360} {S + 50}"><rect width="100%" height="100%" fill="#fff"/>',
         txt(S / 2, 30, "Matriz de poder e interés", 20, "middle", "bold")]
    # la línea divisoria está en 3.5 (alto = 4 o 5): 60% desde el lado de "bajo"
    cx_, cy_ = M + 0.6 * G, M + 0.4 * G
    for (x0, y0, w, h, name, fill) in [(M, M, cx_ - M, cy_ - M, "Mantener satisfecho", "#f4efe3"), (cx_, M, M + G - cx_, cy_ - M, "Gestionar atentamente", "#f3dede"),
                                       (M, cy_, cx_ - M, M + G - cy_, "Monitorear", "#eeeeee"), (cx_, cy_, M + G - cx_, M + G - cy_, "Mantener informado", "#e1ecf5")]:
        o.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="{fill}" stroke="#999"/>')
        o.append(txt(x0 + w / 2, y0 + 22, name, 15, "middle", "bold", "#444"))
    o.append(txt(M + G / 2, S - 20, "Interés (1 a 5)", 15, "middle")); o.append(f'<text transform="translate(24,{M + G / 2}) rotate(-90)" font-size="15" text-anchor="middle" style="{FONT}">Poder (1 a 5)</text>')
    groups = {}
    for n, s in enumerate(ST, 1): groups.setdefault((s['p'], s['i']), []).append(n)
    for (p, i), ids in groups.items():
        cx, cy = pt(p, i)
        for k, n in enumerate(ids):
            ox = (k - (len(ids) - 1) / 2) * 30
            o.append(f'<circle cx="{cx + ox}" cy="{cy + 8}" r="13" fill="{BLUE}" stroke="#fff" stroke-width="1.5"/>' + txt(cx + ox, cy + 13, str(n), 13, "middle", "bold", "#fff"))
    for n, s in enumerate(ST, 1):
        y = 70 + n * 30
        o.append(f'<circle cx="{S + 20}" cy="{y - 5}" r="11" fill="{BLUE}"/>' + txt(S + 20, y - 1, str(n), 12, "middle", "bold", "#fff") + txt(S + 40, y, s['nombre'], 14))
    o.append('</svg>'); return "".join(o)

# ---------- EDT ----------
def edt():
    groups = {}
    for c, n, h, *_ in P['edt']: groups.setdefault(c.split('.')[0], []).append((c, n, h))
    names = {"1": "Gestión del proyecto", "2": "Datos (Bases de Datos II)", "3": "Aplicación web", "4": "Calidad y pruebas", "5": "Cierre"}
    CW, GAP = 270, 14; W = 5 * CW + 4 * GAP + 20; maxn = max(len(v) for v in groups.values())
    H = 70 + 60 + 40 + maxn * 30 + 30
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="100%" height="100%" fill="#fff"/>',
         txt(W / 2, 28, "Estructura de desglose del trabajo (EDT)", 20, "middle", "bold")]
    o.append(f'<rect x="{W / 2 - 150}" y="42" width="300" height="38" rx="6" fill="{BLUE}"/>' + txt(W / 2, 66, "0  SISG – Módulo Grupo 4", 16, "middle", "bold", "#fff"))
    cols = [BLUE, BLUE, GREEN, "#6b5ca5", ORANGE]
    for k, g in enumerate("12345"):
        x = 10 + k * (CW + GAP); cx = x + CW / 2
        o.append(f'<path d="M{W / 2},80 L{W / 2},96 L{cx},96 L{cx},112" fill="none" stroke="#666" stroke-width="1.5"/>')
        o.append(f'<rect x="{x}" y="112" width="{CW}" height="36" rx="6" fill="{cols[k]}"/>' + txt(cx, 135, f"{g}  {names[g]}", 15, "middle", "bold", "#fff"))
        for j, (c, n, h) in enumerate(groups[g]):
            y = 160 + j * 30
            o.append(f'<rect x="{x}" y="{y}" width="{CW}" height="26" fill="#f6f6f6" stroke="#ccc"/>' + txt(x + 8, y + 18, f"{c}  {n}", 13) + txt(x + CW - 8, y + 18, f"{h} h", 13, "end", "normal", "#555"))
    o.append('</svg>'); return "".join(o)

ST = [{"nombre": n, "p": p, "i": i} for n, p, i in [
 ("Docentes", 5, 5), ("Equipo del Grupo 4", 4, 5), ("Gestor de plataforma (G8)", 5, 4), ("Ministerio, INE y Estado", 5, 4), ("Hospitales y red pública", 4, 4), ("Seguro social (G3)", 3, 4),
 ("Centros de diagnóstico", 3, 5), ("Organismos no lucrativos", 3, 5), ("Aseguradoras (G5)", 3, 3), ("Organismos internacionales (G6)", 3, 3), ("Universidades (G7)", 2, 3), ("Pacientes", 2, 2)]]
json.dump(ST, open('stake.json', 'w'), ensure_ascii=False)
page = "<!doctype html><meta charset='utf-8'><body style='margin:0;background:#fff'>" + "".join(f'<div id="{k}" style="display:inline-block">{f()}</div><br>' for k, f in [("gantt", gantt), ("pdm", pdm), ("poder", poder), ("edt", edt)]) + "</body>"
open('fig/f.html', 'w').write(page); print(len(page))
