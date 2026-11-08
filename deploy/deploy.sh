#!/usr/bin/env bash
# Builds the production image on this machine and releases it to the Lightsail instance.
#
#   deploy/deploy.sh                 # test, build, ship, migrate, restart, verify (auto-rollback)
#   deploy/deploy.sh --skip-tests    # skip local checks (emergency fixes only)
#   deploy/deploy.sh --setup         # also (re)run server-setup.sh on the host first
#
# Requires: Docker, an SSH key at $SSH_KEY, AWS CLI profile $AWS_PROFILE (to look up the IP),
# and /opt/freelanceflow/.env.production already on the server (see docs/deployment/ENVIRONMENT_VARIABLES.md).
# Building happens locally because a Next.js build can exhaust 2 GB of RAM on the server.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/config.sh

RUN_TESTS=1
SETUP=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) RUN_TESTS=0 ;;
    --setup) SETUP=1 ;;
    *) echo "Unknown option $arg" >&2; exit 2 ;;
  esac
done

HOST=$(deploy_host)
TAG="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . ':!docs' ':!submission' || echo "-dirty")-$(date -u +%Y%m%d%H%M)"
IMAGE="freelanceflow-app:$TAG"
remote() { ssh "${ssh_opts[@]}" "$SSH_USER@$HOST" "$@"; }

echo "==> Target $SSH_USER@$HOST ($APP_DOMAIN), image $IMAGE"

if (( RUN_TESTS )); then
  echo "==> Local checks"
  npm run typecheck
  npm run lint
  npm run test:unit
fi

echo "==> Building the Next.js standalone bundle on this machine (.next-deploy)"
# A cold build needs ~7 GB of RAM, more than Docker Desktop's VM, so it runs on the host.
# NEXT_PUBLIC_PAYPAL_CLIENT_ID is blanked so the bundle reads the client id at runtime instead
# of inlining whatever the local .env contains.
NEXT_DIST_DIR=.next-deploy NEXT_OUTPUT=standalone NEXT_PUBLIC_PAYPAL_CLIENT_ID= \
  BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime npx prisma generate
NEXT_DIST_DIR=.next-deploy NEXT_OUTPUT=standalone NEXT_PUBLIC_PAYPAL_CLIENT_ID= \
  BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime npx next build
ls .next-deploy/standalone/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node >/dev/null

echo "==> Packaging $IMAGE (linux/amd64)"
DOCKER_BUILDKIT=1 docker build --platform linux/amd64 -f Dockerfile.prebuilt -t "$IMAGE" .

echo "==> Uploading deployment files"
remote "sudo mkdir -p $REMOTE_DIR && sudo chown $SSH_USER:$SSH_USER $REMOTE_DIR"
scp "${ssh_opts[@]}" -q compose.prod.yml deploy/Caddyfile deploy/server-setup.sh deploy/release.sh \
  deploy/rollback.sh deploy/backup.sh deploy/restore.sh deploy/monitor.sh deploy/cleanup-demo.sh \
  "$SSH_USER@$HOST:$REMOTE_DIR/"
remote "chmod +x $REMOTE_DIR/*.sh"

if (( SETUP )); then
  echo "==> Server setup"
  remote "bash $REMOTE_DIR/server-setup.sh"
fi

remote "test -f $REMOTE_DIR/.env.production" || {
  echo "Missing $REMOTE_DIR/.env.production on the server. Create it from .env.production.example first." >&2
  exit 1
}

echo "==> Shipping image ($(docker image inspect "$IMAGE" --format '{{.Size}}' | awk '{printf "%.0f MB", $1/1048576}') uncompressed)"
docker save "$IMAGE" | gzip -1 | remote "gunzip | docker load"

echo "==> Releasing"
remote "cd $REMOTE_DIR && ./release.sh $IMAGE"

echo "==> Public health check"
for _ in $(seq 1 20); do
  if body=$(curl -fsS --max-time 10 "https://$APP_DOMAIN/api/health"); then
    echo "$body"
    echo "==> Deployed $IMAGE to https://$APP_DOMAIN"
    exit 0
  fi
  sleep 6
done
echo "!! https://$APP_DOMAIN/api/health did not respond. On the server: ./rollback.sh" >&2
exit 1
