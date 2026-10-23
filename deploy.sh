#!/bin/bash
echo "Starter oppdatering av Kattfisking..."
cd "$(dirname "$0")" || exit 1
git pull origin main
sudo systemctl restart ntnu-guesser 2>/dev/null || sudo systemctl restart kattfisking 2>/dev/null || true
echo "Kattfisking er oppdatert og restartet!"
