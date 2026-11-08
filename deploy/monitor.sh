#!/usr/bin/env bash
# Runs ON the server (cron: every 5 minutes). Logs one line of health and resource usage and
# restarts the app if its health check has failed. Free: uses only Docker and OS tools.
#   tail -f /opt/freelanceflow/monitor.log
set -uo pipefail
cd /opt/freelanceflow
dc() { docker compose -f compose.prod.yml --env-file .env.production "$@"; }

cid=$(dc ps -q app 2>/dev/null)
health=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
mem=$(free -m | awk '/^Mem:/ {printf "%d/%dMB", $3, $2}')
swap=$(free -m | awk '/^Swap:/ {printf "%dMB", $3}')
disk=$(df -h / | awk 'NR==2 {print $5}')
load=$(cut -d' ' -f1 /proc/loadavg)
echo "$(date -u +%FT%TZ) app=$health mem=$mem swap=$swap disk=$disk load=$load"

if [[ "$health" == "unhealthy" || "$health" == "missing" ]]; then
  echo "$(date -u +%FT%TZ) app not healthy, restarting"
  dc up -d app
fi
disk_pct=${disk%\%}
if (( disk_pct >= 85 )); then
  echo "$(date -u +%FT%TZ) WARNING disk ${disk} used; pruning unused Docker data"
  docker system prune -f >/dev/null 2>&1
fi
# Keep this log small.
tail -n 5000 monitor.log > monitor.log.tmp 2>/dev/null && mv monitor.log.tmp monitor.log
