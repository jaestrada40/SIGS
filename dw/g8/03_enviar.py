"""Conecta con el Grupo 8 y envía a ingesta_g4_servicio SOLO las filas del CSV que aún no están en vw_g4_fact_servicio.
Sin --enviar es de solo lectura (SELECT). Uso:
  G4_PASS=... python3 03_enviar.py            # prueba la conexión y dice qué faltaría
  G4_PASS=... python3 03_enviar.py --enviar   # inserta lo que falta (pide confirmar)
Requiere pymysql y cryptography. La contraseña va solo por variable de entorno."""
import csv, os, sys, pymysql
from decimal import Decimal

K = ("sk_tiempo", "sk_establecimiento", "sk_geografia", "sk_servicio")
c = pymysql.connect(host=os.environ.get("G8_HOST", "tokaido.proxy.rlwy.net"), port=int(os.environ.get("G8_PORT", 45049)),
                    user=os.environ.get("G8_USER", "usr_grupo4"), password=os.environ["G4_PASS"],
                    database=os.environ.get("G8_DB", "sisg_analitica"), connect_timeout=15)
cur = c.cursor()
cur.execute("SELECT 1"); print("conexión OK")

mio = {tuple(int(r[k]) for k in K): (int(r["servicios"]), Decimal(r["monto_cobrado"]))
       for r in csv.DictReader(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "g4_ingesta_dryrun.csv")))}
cur.execute("SELECT sk_tiempo,sk_establecimiento,sk_geografia,sk_servicio FROM vw_g4_fact_servicio")
ya = set(cur.fetchall())
faltan = {k: v for k, v in mio.items() if k not in ya}
print(f"CSV: {len(mio)} · ya en el Grupo 8: {len(mio) - len(faltan)} · faltan: {len(faltan)}")

if "--enviar" in sys.argv and faltan:
    if input(f"¿Insertar {len(faltan)} filas en ingesta_g4_servicio? (si/no) ") != "si": sys.exit("cancelado")
    cur.executemany("INSERT INTO ingesta_g4_servicio (sk_tiempo,sk_establecimiento,sk_geografia,sk_servicio,servicios,monto_cobrado) VALUES (%s,%s,%s,%s,%s,%s)",
                    [(*k, *v) for k, v in faltan.items()])
    c.commit(); print("insertadas:", cur.rowcount)
