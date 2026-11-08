#!/usr/bin/env bash
# Runs ON the server. Switches the app back to the previous image (or a given one).
#   ./rollback.sh                          # previous release
#   ./rollback.sh freelanceflow-app:<tag>  # a specific image still on the host
# Database migrations are forward-only: rolling back the app does not undo schema changes.
# Keep migrations backward compatible (add columns/tables; don't drop or rename in the same
# release) so the previous image keeps working against the migrated schema.
set -euo pipefail
cd /opt/freelanceflow
TARGET="${1:-$(cat .previous-image 2>/dev/null || true)}"
[[ -n "$TARGET" ]] || { echo "No previous image recorded. Available:"; docker images freelanceflow-app; exit 1; }
docker image inspect "$TARGET" >/dev/null

CURRENT=$(grep '^APP_IMAGE=' .env.production | cut -d= -f2- | tr -d '"')
sed -i "s#^APP_IMAGE=.*#APP_IMAGE=$TARGET#" .env.production
echo "$CURRENT" > .previous-image
docker compose -f compose.prod.yml --env-file .env.production up -d app

for _ in $(seq 1 45); do
  cid=$(docker compose -f compose.prod.yml --env-file .env.production ps -q app)
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null)" == "healthy" ]] && { echo "Rolled back to $TARGET (was $CURRENT)"; exit 0; }
  sleep 4
done
echo "!! $TARGET is not healthy; check: docker compose -f compose.prod.yml --env-file .env.production logs app" >&2
exit 1
