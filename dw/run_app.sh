#!/usr/bin/env bash
# Igual que run.sh, pero la fuente son los datos reales de la app (Postgres) en lugar de datos sintéticos.
# Uso: ./run_app.sh [base_postgres]   (por defecto: sisg)   Contenedor Postgres: backend-db-1
set -euo pipefail
cd "$(dirname "$0")"
PGDB="${1:-sisg}"; PG="docker exec -i backend-db-1 psql -U sisg -d $PGDB -q"
mysql_() { docker compose exec -T mysql mysql -uroot -psisg_dev --default-character-set=utf8mb4 "$@" 2>&1 | grep -v "Using a password" || true; }

docker compose up -d --wait

echo ">> exportando de Postgres ($PGDB) a CSV (sin contraseñas)"
# El CSV lo escribe Python: en algunos equipos macOS la redirección del shell (> archivo) falla con «Operation not permitted» sobre data/.
exp() { $PG -c "COPY ($2) TO STDOUT WITH (FORMAT csv)" | python3 -c 'import sys; open(sys.argv[1], "wb").write(sys.stdin.buffer.read())' "data/$1.csv"; }
exp entidad  'SELECT id, nombre, tipo, departamento, telefono, correo FROM entidad ORDER BY id'
exp paciente 'SELECT id, "entidadId", "nombreCompleto", dpi, "fechaNacimiento", sexo, departamento, municipio, telefono, estado FROM paciente ORDER BY id'
exp estudio  'SELECT id, "entidadId", "pacienteId", "tipoEstudio", "salaEquipo", fecha, hora, especialista, resultado, estado FROM estudio ORDER BY id'
exp campana  'SELECT id, "entidadId", nombre, area, departamento, ubicacion, "fechaInicio", "fechaFin", "personasAtendidas", estado FROM campana ORDER BY id'

# Orden: esquema -> catálogos -> staging -> mapeo -> triggers (después, para no auditar la carga) -> DW -> ETL
for f in sql/01_fuente_esquema.sql sql/01b_catalogos.sql puente/01_staging.sql puente/02_mapeo.sql sql/03_fuente_triggers.sql sql/04_dw_esquema.sql sql/05_dw_etl.sql; do
  echo ">> $f"; mysql_ < "$f"
done
echo ">> ETL"
mysql_ --table -e "CALL sisg_dw.sp_etl_completo(); SELECT * FROM sisg_dw.etl_log ORDER BY id DESC LIMIT 1\G"
echo ">> reconciliación fuente–DW"
mysql_ --table < sql/07_reconciliacion.sql
