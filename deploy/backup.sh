#!/usr/bin/env bash
# Runs ON the server (cron: daily 03:15 UTC). Writes a compressed pg_dump to
# /opt/freelanceflow/backups (mode 600, directory 700) and keeps the newest 7 days.
# Backups stay on the instance's own disk: no paid AWS snapshot or storage service is used.
set -euo pipefail
cd /opt/freelanceflow
RETENTION_DAYS="${RETENTION_DAYS:-7}"
umask 077
mkdir -p backups
file="backups/freelanceflow-$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f "$file.partial"' ERR
docker compose -f compose.prod.yml --env-file .env.production exec -T db \
  pg_dump -U freelanceflow -d freelanceflow --format=custom --compress=6 > "$file.partial"
mv "$file.partial" "$file"
find backups -name 'freelanceflow-*.dump' -mtime "+$RETENTION_DAYS" -delete
echo "$(date -u +%FT%TZ) backup ok: $file ($(du -h "$file" | cut -f1))"
