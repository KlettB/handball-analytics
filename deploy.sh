#!/bin/bash
# Usage:
#   ./deploy.sh                # pull, build, restart
#   ./deploy.sh --reset-db     # wipe DB first (use after TEAM_ID change)
#   ./deploy.sh --fetch        # trigger a data fetch after the restart
#   ./deploy.sh --reset-db --fetch
set -e

RESET_DB=0
FETCH=0
for arg in "$@"; do
  case "$arg" in
    --reset-db) RESET_DB=1 ;;
    --fetch)    FETCH=1 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

echo "==> Pulling latest code..."
git pull origin main

if [ "$RESET_DB" = "1" ]; then
  echo "==> Resetting database..."
  ./reset-db.sh
fi

echo "==> Installing server dependencies..."
npm install --omit=dev

echo "==> Installing client dependencies & building..."
cd client && npm install && npx vite build && cd ..

echo "==> Restarting app..."
pm2 restart handball-statistics

if [ "$FETCH" = "1" ]; then
  echo "==> Triggering data fetch..."
  sleep 2
  curl -fsS -X POST http://localhost:3001/api/fetch-data
  echo ""
fi

echo "==> Done."
pm2 status handball-statistics
