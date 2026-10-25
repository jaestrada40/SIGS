#!/usr/bin/env bash
# Levanta MySQL y ejecuta los scripts en orden. Uso: ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
docker compose up -d --wait
for f in sql/0[1-5]*.sql; do
  echo ">> $f"
  docker compose exec -T mysql mysql -uroot -psisg_dev --default-character-set=utf8mb4 < "$f" 2>&1 | grep -v "Using a password" || true
done
echo ">> carga ETL"
docker compose exec -T mysql mysql -uroot -psisg_dev -e "CALL sisg_dw.sp_etl_completo(); SELECT * FROM sisg_dw.etl_log ORDER BY id DESC LIMIT 1\G" 2>&1 | grep -v "Using a password"
echo ">> consultas (resultados en sql/06_consultas.sql; ejecútalo con ./consultas.sh)"
