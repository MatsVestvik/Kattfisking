#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"

if [ "$1" = "restart" ] || [ "$1" = "--restart" ]; then
  echo "Stopper eventuell kjørende Kattfisking på port $PORT..."
  fuser -k "${PORT}/tcp" 2>/dev/null || pkill -f "python3 server.py" 2>/dev/null || true
  sleep 1
fi

if ss -tulpn 2>/dev/null | grep -q ":$PORT " || lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "⚠️  Port $PORT er allerede i bruk."
  echo "🐈🐟 Kattfisking kjører antakeligvis allerede på http://localhost:$PORT"
  echo ""
  echo "Alternativer:"
  echo "  1) Åpne nettleseren på: http://localhost:$PORT"
  echo "  2) Starte på nytt:      ./start.sh restart"
  echo "  3) Starte på ny port:   PORT=$((PORT + 1)) ./start.sh"
  exit 0
fi

if command -v node >/dev/null 2>&1; then
  echo "Starter Kattfisking med Node.js på port $PORT..."
  exec node server.js
else
  echo "Starter Kattfisking med Python 3 på port $PORT..."
  exec python3 server.py
fi
