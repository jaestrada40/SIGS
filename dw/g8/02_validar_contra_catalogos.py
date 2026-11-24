"""Valida g4_ingesta_dryrun.csv contra los catálogos y hechos del Grupo 8 (solo SELECT, no inserta).
Uso: G4_PASS=... python3 02_validar_contra_catalogos.py   (requiere pymysql y cryptography)"""
import csv, os, pymysql
from decimal import Decimal

c = pymysql.connect(host="tokaido.proxy.rlwy.net", port=45049, user="usr_grupo4",
                    password=os.environ["G4_PASS"], database="sisg_analitica", connect_timeout=15)
def rows(s):
    cur = c.cursor(); cur.execute(s); return cur.fetchall()

here = os.path.dirname(os.path.abspath(__file__))
R = {}
for r in csv.DictReader(open(os.path.join(here, "g4_ingesta_dryrun.csv"))):
    R[tuple(int(r[k]) for k in ("sk_tiempo", "sk_establecimiento", "sk_geografia", "sk_servicio"))] = (int(r["servicios"]), Decimal(r["monto_cobrado"]))
print("filas del dry-run:", len(R))
for i, (col, sql) in enumerate([("sk_tiempo", "vw_cat_tiempo"), ("sk_establecimiento", "vw_cat_establecimiento"),
                                ("sk_geografia", "vw_cat_geografia"), ("sk_servicio", "vw_cat_servicio")]):
    ok = {r[0] for r in rows(f"SELECT {col} FROM {sql}")}
    print(f"{col} inválidos:", sorted({k[i] for k in R} - ok))
ex = rows("SELECT sk_tiempo,sk_establecimiento,sk_geografia,sk_servicio,servicios,monto_cobrado FROM vw_g4_fact_servicio")
exd = {r[:4]: (r[4], r[5]) for r in ex}
print("filas en vw_g4_fact_servicio:", len(ex))
print("claves del dry-run ya cargadas:", sum(k in exd for k in R))
print("con valores distintos:", sum(k in exd and exd[k] != v for k, v in R.items()))
print("filas cargadas que no son del dry-run:", sorted(set(exd) - set(R)))
