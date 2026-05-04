#!/bin/bash
# One-shot helper to wipe the SQLite database.
# Use when switching TEAM_ID / SEASON so the next fetch starts from scratch.
set -e

DB_DIR="$(dirname "$0")/server/data"

if [ ! -d "$DB_DIR" ]; then
  echo "Keine Datenbank gefunden (Verzeichnis $DB_DIR fehlt)."
  exit 0
fi

rm -fv "$DB_DIR/handball.db" "$DB_DIR/handball.db-wal" "$DB_DIR/handball.db-shm"
echo "==> Datenbank gelöscht. Nächster Fetch baut sie neu auf."
