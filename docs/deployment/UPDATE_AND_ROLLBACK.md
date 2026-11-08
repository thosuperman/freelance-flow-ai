# Updating and rolling back

## Deploy a new version

From a clean checkout on the admin machine (Docker running, `~/.ssh/freelanceflow-prod` present, AWS profile `hayaitech` configured):

```bash
deploy/deploy.sh
```

What it does:

1. Runs `npm run typecheck`, `npm run lint` and `npm run test:unit` (skip with `--skip-tests` only for emergencies).
2. Builds the Next.js standalone bundle on your machine (`.next-deploy/`), then packages it as `freelanceflow-app:<git-sha>-<UTC timestamp>` for `linux/amd64` with `Dockerfile.prebuilt`.
3. Uploads the compose file, Caddyfile and server scripts.
4. Streams the image to the server (`docker save | gzip | ssh docker load`).
5. Runs [release.sh](../../deploy/release.sh) on the server:
   - records the current image in `.previous-image`
   - starts PostgreSQL and waits until it is healthy
   - takes a backup
   - runs `prisma migrate deploy`
   - starts the new image and waits up to ~3 minutes for its health check
   - **if it never becomes healthy, switches back to the previous image automatically**
   - keeps the three most recent images for manual rollback
6. Calls `https://freelanceflow.hayaix.tech/api/health` from your machine.

Expect a few seconds of downtime while the app container is replaced. This is a single-server setup, so there are no zero-downtime deploys.

Run the integration and end-to-end tests (`npm run test:integration`, `npm run test:e2e`) before deploying anything that touches payments, approvals or money.

## Roll back

```bash
ssh -i ~/.ssh/freelanceflow-prod ubuntu@184.195.111.183
cd /opt/freelanceflow
./rollback.sh                              # back to the previous image
docker images freelanceflow-app            # list images still on the host
./rollback.sh freelanceflow-app:<tag>      # a specific one
```

Rolling back the app does not undo migrations; see [DATABASE_BACKUP.md](DATABASE_BACKUP.md#migrations).

## Restart

```bash
cd /opt/freelanceflow
docker compose -f compose.prod.yml --env-file .env.production restart app     # app only
docker compose -f compose.prod.yml --env-file .env.production up -d           # everything
```

## Continuous deployment

There is no CI/CD pipeline on purpose: `deploy.sh` is one command and needs no cloud credentials stored anywhere except the admin machine. A GitHub Actions workflow could run the same script later; it would need the SSH key and AWS read access as repository secrets.
