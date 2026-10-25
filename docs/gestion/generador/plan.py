from datetime import date, timedelta
import json
HOY = date(2026, 10, 24)

# --- EDT: (codigo, paquete, horas planificadas, inicio, fin, % avance, responsable) ---
D = lambda m, d: date(2026, m, d)
EDT = [
 ("1.1","Acta de constitución y alcance",6,D(10,24),D(10,26),50,"Líder"),
 ("1.2","EDT, cronograma y costos",6,D(10,24),D(10,27),50,"Líder"),
 ("1.3","Interesados y comunicaciones",5,D(10,24),D(10,28),50,"Líder"),
 ("1.4","Riesgos y calidad",6,D(10,24),D(10,30),50,"Calidad"),
 ("1.5","Reportes de estado semanales",3,D(11,1),D(11,20),0,"Líder"),
 ("2.1","ER de las fuentes",8,D(10,15),D(10,25),100,"Datos"),
 ("2.2","Modelo estrella",8,D(10,24),D(10,30),80,"Datos"),
 ("2.3","ETL",10,D(10,24),D(11,10),70,"Datos"),
 ("2.4","Consultas analíticas",6,D(10,24),D(11,14),60,"Datos"),
 ("2.5","Documento técnico BD II",8,D(11,9),D(11,27),20,"Datos"),
 ("3.1","Backend y autenticación",25,D(10,5),D(10,23),100,"Calidad"),
 ("3.2","Interfaz y rediseño",12,D(10,24),D(10,24),100,"Calidad"),
 ("3.3","Carga masiva y bitácora",12,D(10,24),D(10,24),100,"Calidad"),
 ("3.4","Seguridad y usuarios",12,D(10,24),D(10,24),100,"Calidad"),
 ("4.1","Pruebas e2e",8,D(10,5),D(10,24),100,"Calidad"),
 ("4.2","Reconciliación fuente–DW",3,D(10,24),D(10,24),100,"Calidad"),
 ("4.3","Revisión por pares y verificación",6,D(11,9),D(11,20),0,"Calidad"),
 ("5.1","Informe de cierre y lecciones",8,D(11,12),D(11,19),0,"Todos"),
 ("5.2","Preparar y dar la exposición final",10,D(11,16),D(11,21),0,"Todos"),
 ("5.3","Ajustes y entrega final BD II",6,D(11,23),D(11,28),0,"Datos"),
]
def pv(h, ini, fin):
    if HOY >= fin: return h
    if HOY < ini: return 0
    return h * ((HOY - ini).days + 1) / ((fin - ini).days + 1)
BAC = sum(e[2] for e in EDT)
PV = sum(pv(e[2], e[3], e[4]) for e in EDT)
EV = sum(e[2] * e[5] / 100 for e in EDT)
res_edt = {"BAC": BAC, "PV": round(PV, 1), "EV": round(EV, 1), "SPI": round(EV / PV, 2), "avance": round(100 * EV / BAC),
           "contingencia_pct": 13, "contingencia": round(0.13 * BAC, 1), "contingencia_10pct": round(0.10 * BAC, 1), "gestion_5pct": round(0.05 * BAC, 1)}

# --- Red de actividades restantes (PDM) en días calendario; el día 0 es el lunes 26 de octubre ---
# pred: lista de (id, desfase en días; negativo = se solapa). Restricciones reales:
#   J (exposición): no antes del 20 de nov. y debe terminar el 21 (semana 19)   L (entrega BD II): antes del 28 nov. 8:00
ACT = [  # id, nombre, duración, predecesoras, O, M, P
 ("A","Validar acta, alcance y EDT con el grupo",2,[],1,2,4),
 ("B","Presentar el diseño estrella (tarea del 30 de oct.)",5,[],3,5,6),
 ("C","Alimentar el ETL con datos reales de la app",6,[("B",0)],4,6,10),
 ("D","Consultas finales y análisis con EXPLAIN",5,[("C",0)],3,5,8),
 ("E","Documento técnico de Bases de Datos II",8,[("D",0)],6,8,12),
 ("F","Riesgos y calidad finalizados",6,[("A",0)],4,6,8),
 ("G","Plan de comunicaciones y reportes de estado",4,[("A",0)],3,4,6),
 ("H","Informe de cierre y lecciones aprendidas",5,[("F",0),("G",0)],4,5,8),
 ("I","Preparar la exposición final",4,[("H",0)],3,4,6),
 ("J","Exposición final (semana 19)",2,[("I",0)],1,2,2),
 ("K","Revisión por pares y lista de verificación",5,[("E",-2)],3,5,7),
 ("L","Ajustes y entrega final de Bases de Datos II",4,[("K",0)],3,4,6),
]
S0 = D(10,26)
SNET = {"J": (D(11,20) - S0).days}                      # inicio no antes de
LIMITE = {"J": (D(11,22) - S0).days, "L": (D(11,28) - S0).days}   # fin tardío fijo
dur = {a[0]: a[2] for a in ACT}; pred = {a[0]: a[3] for a in ACT}
ES, EF = {}, {}
for a in ACT:
    i = a[0]; ES[i] = max([EF[p] + lag for p, lag in pred[i]] + [SNET.get(i, 0), 0]); EF[i] = ES[i] + dur[i]
fin = max(EF.values())
succ = {a[0]: [(b[0], dict(b[3])[a[0]]) for b in ACT if a[0] in dict(b[3])] for a in ACT}
LF, LS = {}, {}
for a in reversed(ACT):
    i = a[0]
    LF[i] = min([LS[s] - lag for s, lag in succ[i]] + ([LIMITE[i]] if i in LIMITE else []) + ([fin] if not succ[i] and i not in LIMITE else []))
    LS[i] = LF[i] - dur[i]
hol = {k: LS[k] - ES[k] for k in dur}
minh = min(hol.values())
crit = [a[0] for a in ACT if hol[a[0]] == minh]
fecha = lambda n: S0 + timedelta(days=n)
red = [{"id": a[0], "nombre": a[1], "dur": a[2], "pred": ",".join(p + (f"({lag:+d})" if lag else "") for p, lag in a[3]) or "—",
        "ES": ES[a[0]], "EF": EF[a[0]], "LS": LS[a[0]], "LF": LF[a[0]], "holgura": hol[a[0]],
        "inicio": fecha(ES[a[0]]).isoformat(), "fin": (fecha(EF[a[0]]) - timedelta(days=1)).isoformat(), "O": a[4], "M": a[5], "P": a[6],
        "PERT": round((a[4] + 4 * a[5] + a[6]) / 6, 1), "sigma": round((a[6] - a[4]) / 6, 2)} for a in ACT]
ruta_pert = round(sum(r["PERT"] for r in red if r["id"] in crit), 1)
var = round(sum(r["sigma"] ** 2 for r in red if r["id"] in crit) ** 0.5, 2)
fin_bd2 = EF["L"]
out = {"edt": [[*e[:3], e[3].isoformat(), e[4].isoformat(), e[5], e[6]] for e in EDT], "evm": res_edt, "red": red, "critica": crit,
       "duracion_total_dias": fin, "fin_calculado": (fecha(fin_bd2) - timedelta(days=1)).isoformat(), "holgura_min": minh, "limite_bd2": "2026-11-28", "pert_ruta_critica": ruta_pert, "sigma_ruta": var}
import math
cad = ["B","C","D","E","K","L"]; R = {r["id"]: r for r in red}
esp = round(sum(R[i]["PERT"] for i in cad) - 2, 1)          # -2 por el solape de K con E
sig = round(math.sqrt(sum(R[i]["sigma"] ** 2 for i in cad)), 2)
z = (LIMITE["L"] - esp) / sig; prob = round(100 * 0.5 * (1 + math.erf(z / math.sqrt(2))))
out["cadena_bd2"] = {"actividades": cad, "esperado_dias": esp, "sigma": sig, "limite_dias": LIMITE["L"], "z": round(z, 2), "prob_cumplir_pct": prob,
                     "holgura_dias": min(hol[i] for i in cad)}
json.dump(out, open("plan.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res_edt)); print("crítica:", "→".join(crit), "| holgura mínima:", minh, "| fin BD2:", out["fin_calculado"], "| límite día:", LIMITE["L"], "| PERT ruta:", ruta_pert, "±", var)
for r in red: print(r["id"], r["dur"], r["pred"], r["ES"], r["EF"], r["holgura"], r["inicio"], r["fin"], r["PERT"])
print(out["cadena_bd2"])
