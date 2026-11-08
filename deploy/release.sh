#!/usr/bin/env bash
# Runs ON the server. Switches the stack to an already-loaded image, applies migrations,
# waits for the health check and rolls back automatically if the new version is unhealthy.
#   ./release.sh freelanceflow-app:<tag>
set -euo pipefail
cd /opt/freelanceflow
NEW_IMAGE="${1:?usage: release.sh <image>}"
ENV_FILE=.env.production
dc() { docker compose -f compose.prod.yml --env-file "$ENV_FILE" "$@"; }

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
docker image inspect "$NEW_IMAGE" >/dev/null

set_image() {
  if grep -q '^APP_IMAGE=' "$ENV_FILE"; then
    sed -i "s#^APP_IMAGE=.*#APP_IMAGE=$1#" "$ENV_FILE"
  else
    echo "APP_IMAGE=$1" >> "$ENV_FILE"
  fi
}

wait_healthy() {
  local cid status
  for _ in $(seq 1 45); do
    cid=$(dc ps -q app)
    status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)
    [[ "$status" == "healthy" ]] && return 0
    sleep 4
  done
  return 1
}

PREV_IMAGE=$(grep '^APP_IMAGE=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
if [[ -n "$PREV_IMAGE" && "$PREV_IMAGE" != "$NEW_IMAGE" ]]; then
  echo "$PREV_IMAGE" > .previous-image
fi

# Compose interpolates APP_IMAGE for every service, so set it before the first command.
set_image "$NEW_IMAGE"

echo "==> Database"
dc up -d --wait db

echo "==> Backup before migrating"
./backup.sh || echo "warning: pre-release backup failed"

echo "==> Migrations (prisma migrate deploy; never resets data)"
dc run --rm migrate

echo "==> Starting $NEW_IMAGE"
dc up -d app caddy
if wait_healthy; then
  echo "==> Healthy: $NEW_IMAGE"
  # Keep the three most recent app images for rollback; remove older ones.
  docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' freelanceflow-app \
    | sort -k2 -r | awk 'NR>3 {print $1}' | grep -v -x -e "$NEW_IMAGE" -e "${PREV_IMAGE:-none}" \
    | xargs -r docker rmi >/dev/null 2>&1 || true
else
  echo "!! $NEW_IMAGE did not become healthy" >&2
  dc logs --tail 80 app >&2 || true
  if [[ -n "$PREV_IMAGE" && "$PREV_IMAGE" != "$NEW_IMAGE" ]]; then
    echo "==> Rolling back to $PREV_IMAGE" >&2
    set_image "$PREV_IMAGE"
    dc up -d app
    wait_healthy && echo "Rolled back to $PREV_IMAGE" >&2
  fi
  exit 1
fi
