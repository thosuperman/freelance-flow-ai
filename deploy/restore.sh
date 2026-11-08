#!/usr/bin/env bash
# Runs ON the server. Restores a backup made by backup.sh. Destructive for current data,
# so it requires --yes and takes a fresh safety backup first.
#   ./restore.sh backups/freelanceflow-20261108T031500Z.dump --yes
set -euo pipefail
cd /opt/freelanceflow
FILE="${1:?usage: restore.sh <backup.dump> --yes}"
[[ "${2:-}" == "--yes" ]] || { echo "Refusing to restore without --yes (this replaces the current database)."; exit 1; }
[[ -f "$FILE" ]] || { echo "No such file: $FILE"; exit 1; }
dc() { docker compose -f compose.prod.yml --env-file .env.production "$@"; }

echo "==> Safety backup of the current database"
./backup.sh

echo "==> Stopping the app"
dc stop app

echo "==> Restoring $FILE"
dc exec -T db pg_restore -U freelanceflow -d freelanceflow --clean --if-exists --no-owner < "$FILE"

echo "==> Starting the app"
dc up -d app
echo "Restore complete."
