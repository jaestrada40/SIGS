#!/usr/bin/env bash
# Igual que run.sh, pero la fuente son los datos reales de la app (MySQL) en lugar de datos sintéticos.
# Uso: ./run_app.sh [base_app]   (por defecto: sisg)
# Contenedor de la app: backend-db-1 (o el que indique APP_DB_CONTAINER). Usuario sisg; la clave sale de backend/.env (DB_PASS).
set -euo pipefail
cd "$(dirname "$0")"
APPDB="${1:-sisg}"; APP_CT="${APP_DB_CONTAINER:-backend-db-1}"
APP_PASS="${DB_PASS:-$(grep '^DB_PASS=' ../backend/.env | cut -d= -f2)}"
app_() { docker exec -i -e MYSQL_PWD="$APP_PASS" "$APP_CT" mysql -usisg -B -N --default-character-set=utf8mb4 "$APPDB" -e "$1"; }
mysql_() { docker compose exec -T mysql mysql -uroot -psisg_dev --default-character-set=utf8mb4 "$@" 2>&1 | grep -v "Using a password" || true; }

docker compose up -d --wait

echo ">> exportando de la app ($APP_CT / $APPDB) a CSV (sin contraseñas)"
# El CSV lo escribe Python: en algunos equipos macOS la redirección del shell (> archivo) falla con «Operation not permitted» sobre data/.
# mysql -B entrega texto con tabuladores: NULL (o \N) queda vacío y \t \n \\ vienen escapados.
exp() { app_ "$2" | python3 -c '
import csv, sys, re
esc = {"t": "\t", "n": "\n", "\\": "\\", "0": "\0"}
fix = lambda c: "" if c in ("NULL", "\\N") else re.sub(r"\\([tn\\0])", lambda m: esc[m.group(1)], c)
with open(sys.argv[1], "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    for line in sys.stdin.read().split("\n"):
        if line: w.writerow([fix(c) for c in line.split("\t")])
' "data/$1.csv"; }
exp entidad  "SELECT id, nombre, tipo, departamento, telefono, correo FROM entidad WHERE tipo <> 'PLATAFORMA' ORDER BY id"
exp paciente 'SELECT id, entidadId, nombreCompleto, dpi, fechaNacimiento, sexo, departamento, municipio, telefono, estado FROM paciente ORDER BY id'
exp estudio  'SELECT id, entidadId, pacienteId, tipoEstudio, salaEquipo, fecha, hora, especialista, resultado, estado FROM estudio ORDER BY id'
exp campana  'SELECT id, entidadId, nombre, area, departamento, ubicacion, fechaInicio, fechaFin, personasAtendidas, estado FROM campana ORDER BY id'

# Orden: esquema -> catálogos -> staging -> mapeo -> triggers (después, para no auditar la carga) -> DW -> ETL
for f in sql/01_fuente_esquema.sql sql/01b_catalogos.sql puente/01_staging.sql puente/02_mapeo.sql sql/03_fuente_triggers.sql sql/04_dw_esquema.sql sql/05_dw_etl.sql; do
  echo ">> $f"; mysql_ < "$f"
done
echo ">> ETL"
mysql_ --table -e "CALL sisg_dw.sp_etl_completo(); SELECT * FROM sisg_dw.etl_log ORDER BY id DESC LIMIT 1\G"
echo ">> reconciliación fuente–DW"
mysql_ --table < sql/07_reconciliacion.sql
