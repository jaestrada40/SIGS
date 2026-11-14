#!/usr/bin/env bash
# Comparte el portal (API + interfaz) con otras computadoras de la misma red, solo para demostraciones.
# Uso:  ./compartir_red.sh        (Ctrl+C para detener todo)
# Detecta la IP de la red actual, así que corre este script en la red donde van a presentar.
# La base de datos NO se expone: los puertos 3306 y 3307 siguen solo en esta máquina.
set -euo pipefail
cd "$(dirname "$0")"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
[ -n "$IP" ] || { echo "No encuentro IP de red (¿Wi-Fi conectado?)."; exit 1; }

# Libera los puertos si ya hay una API o interfaz de desarrollo corriendo (la configuración nueva reemplaza a la anterior).
for p in 3000 5173; do
  pids="$(lsof -ti "tcp:$p" -sTCP:LISTEN || true)"
  [ -n "$pids" ] && kill $pids && sleep 1
done

(cd backend && docker compose up -d --wait)

trap 'echo; echo "Deteniendo..."; kill 0' INT TERM
(cd backend && CORS_ORIGINS="http://$IP:5173" npm run start:dev) &
(cd nuevo-diseño && VITE_API_URL="http://$IP:3000" npm run dev -- --host 0.0.0.0 --port 5173 --strictPort) &

echo
echo "Portal para compartir:  http://$IP:5173"
echo "Usuarios de demostración: docs/GUIA_PRESENTACION.md, sección 2b (no usen el superadmin en red)."
echo "Si no cargan: puede que la red aísle los dispositivos, o el firewall de macOS pida permitir 'node'."
wait
