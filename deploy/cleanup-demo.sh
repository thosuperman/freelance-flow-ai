#!/usr/bin/env bash
# Runs ON the server (cron: hourly). Deletes expired demo workspaces through the app's
# protected cleanup endpoint. The request stays inside the container; CRON_SECRET is read
# from the container environment and never written to the crontab.
set -euo pipefail
cd /opt/freelanceflow
cid=$(docker compose -f compose.prod.yml --env-file .env.production ps -q app)
result=$(docker exec "$cid" node -e "fetch('http://127.0.0.1:3000/api/cron/cleanup-demo',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text()).then(t=>console.log(t))")
echo "$(date -u +%FT%TZ) cleanup $result"
