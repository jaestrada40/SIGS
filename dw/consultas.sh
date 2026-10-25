#!/usr/bin/env bash
cd "$(dirname "$0")"
docker compose exec -T mysql mysql -uroot -psisg_dev --table --default-character-set=utf8mb4 < sql/06_consultas.sql 2>&1 | grep -v "Using a password"
