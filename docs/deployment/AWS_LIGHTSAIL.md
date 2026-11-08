# AWS Lightsail deployment

FreelanceFlow AI runs on a single Amazon Lightsail instance. This is deliberately a low-cost, single-server setup: no load balancer, no managed database, no high availability.

## What is deployed

| Item | Value |
| --- | --- |
| Public URL | https://freelanceflow.hayaix.tech |
| AWS CLI profile | `hayaitech` (credentials live in `~/.aws`, never in the repo) |
| Region / zone | `us-east-1` / `us-east-1a` |
| Instance | `freelanceflow-prod`, bundle `small_3_0` (2 vCPU, 2 GB RAM, 60 GB SSD, 3 TB transfer), USD 12/month |
| OS | Ubuntu 24.04 LTS |
| Static IP | `freelanceflow-prod-ip` → `184.195.111.183` |
| SSH key | Lightsail key pair `freelanceflow-prod-key`; private key at `~/.ssh/freelanceflow-prod` on the admin machine |
| Tags | `project=freelanceflow`, `environment=production`, `purpose=paypal-ai-hackathon-2026` |
| App directory | `/opt/freelanceflow` |

```text
Internet ──► Lightsail firewall (80, 443 open; 22 admin IP + Lightsail console)
              │
              ▼
           Caddy :80/:443 (TLS, HTTP→HTTPS)      network "web"
              │
              ▼
           Next.js app :3000 (standalone, non-root)   networks "web" + "data"
              │
              ▼
           PostgreSQL 16 :5432                    network "data" (internal: no internet, no host port)
```

All three run as Docker Compose services ([compose.prod.yml](../../compose.prod.yml)) with `restart: unless-stopped`, so they come back after a crash, a Docker restart or a reboot (verified with a real reboot).

## Files

| File | Runs on | Purpose |
| --- | --- | --- |
| [Dockerfile.prebuilt](../../Dockerfile.prebuilt) | build machine | Packages the host-built standalone bundle for Linux: Prisma Linux engine, Prisma CLI for migrations, non-root `node` user, health check (used by `deploy.sh`) |
| [Dockerfile](../../Dockerfile) | build machine | Alternative full in-container build (needs ~12 GB of Docker memory) |
| [compose.prod.yml](../../compose.prod.yml) | server | Caddy, app, PostgreSQL, one-off `migrate` job |
| [deploy/Caddyfile](../../deploy/Caddyfile) | server | TLS and reverse proxy |
| [deploy/config.sh](../../deploy/config.sh) | local | Names, region, bundle, SSH settings |
| [deploy/provision.sh](../../deploy/provision.sh) | local | Idempotent: key pair, instance, static IP, firewall, Route 53 record |
| [deploy/server-setup.sh](../../deploy/server-setup.sh) | server | Idempotent: Docker, 2 GB swap, log limits, cron |
| [deploy/deploy.sh](../../deploy/deploy.sh) | local | Checks, build, ship image, release, public health check |
| [deploy/release.sh](../../deploy/release.sh) | server | Backup, migrate, switch image, wait for health, auto-rollback |
| [deploy/rollback.sh](../../deploy/rollback.sh) | server | Switch back to the previous image |
| [deploy/backup.sh](../../deploy/backup.sh) / [restore.sh](../../deploy/restore.sh) | server | PostgreSQL dumps |
| [deploy/monitor.sh](../../deploy/monitor.sh) | server | 5-minute health and resource log, self-healing restart |
| [deploy/cleanup-demo.sh](../../deploy/cleanup-demo.sh) | server | Hourly removal of expired demo workspaces |

## First-time setup (already done for the hackathon)

```bash
deploy/provision.sh                 # instance, static IP, firewall, DNS (safe to re-run)
deploy/deploy.sh --setup            # server setup + first release
```

Before the first release, create `/opt/freelanceflow/.env.production` on the server from [.env.production.example](../../.env.production.example) (see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)).

## Day-to-day commands

```bash
deploy/deploy.sh                                    # deploy the current checkout
ssh -i ~/.ssh/freelanceflow-prod ubuntu@184.195.111.183
cd /opt/freelanceflow
alias dc='docker compose -f compose.prod.yml --env-file .env.production'
dc ps                                               # status
dc logs -f --tail 100 app                           # app logs
dc restart app                                      # restart the app
./rollback.sh                                       # previous version
./backup.sh                                         # backup now
tail -n 20 monitor.log                              # health/memory/disk history
```

## Why the app is built on the admin machine

A cold `next build` of this app peaks at about **6.8 GB of RAM** (measured with `/usr/bin/time -l`) and takes about 6 minutes, mostly because of the Bryntum and AG Studio bundles. That is more than the 2 GB server and more than Docker Desktop's 7.8 GB VM, where the in-container build was killed with exit 137. So:

1. `deploy/deploy.sh` runs `next build` with standalone output **on the admin machine** into `.next-deploy/`. The Turbopack cache stays there, so later builds take about a minute.
2. Prisma generates both the native and the Linux (`debian-openssl-3.0.x`) query engines (`binaryTargets` in `prisma/schema.prisma`). The script checks that the Linux engine is in the bundle.
3. [Dockerfile.prebuilt](../../Dockerfile.prebuilt) packages only that bundle, the static files, the schema and the Prisma CLI into a `linux/amd64` image (non-root, with a health check). Its build context is limited by `Dockerfile.prebuilt.dockerignore`.
4. The image is streamed over SSH (`docker save | gzip | docker load`). No container registry is needed.

The original [Dockerfile](../../Dockerfile) (full in-container build) still works where Docker has roughly 12 GB of memory. With `NEXT_LOW_MEMORY_BUILD=1` it also skips client minification, but that alone was not enough at 7.8 GB.

## Measured on 2026-11-07/08

| Metric | Value |
| --- | --- |
| Memory at idle | ~620 MB used of 1.9 GB (app ~80–210 MB, PostgreSQL ~25–55 MB, Caddy ~15–60 MB); swap unused |
| Disk | 6.4 GB of 58 GB (12%) |
| Server-side response time | 40–110 ms for `/` and `/api/health` |
| Load test | `ab -n 300 -c 10` against `/` and `/api/health` from Tokyo: 600/600 succeeded, 0 failures, load average stayed at 0.15. Remote latency (~0.8–1.3 s) is dominated by trans-Pacific round trips and per-request TLS handshakes |
| Reboot | All containers healthy and the public health check OK about 40 s after `sudo reboot` |

## Deleting everything after the hackathon

Take a final backup first if you want to keep any data (`scp` it off the server), then:

```bash
export AWS_PROFILE=hayaitech AWS_DEFAULT_REGION=us-east-1
aws lightsail delete-instance --instance-name freelanceflow-prod
aws lightsail release-static-ip --static-ip-name freelanceflow-prod-ip   # unattached static IPs are billed
aws lightsail delete-key-pair --key-pair-name freelanceflow-prod-key
# Remove the DNS record (only this name; nothing else in the zone):
ZONE=$(aws route53 list-hosted-zones-by-name --dns-name hayaix.tech --query 'HostedZones[0].Id' --output text)
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE" --change-batch \
  '{"Changes":[{"Action":"DELETE","ResourceRecordSet":{"Name":"freelanceflow.hayaix.tech","Type":"A","TTL":300,"ResourceRecords":[{"Value":"184.195.111.183"}]}}]}'
```

Also delete the production webhook (`12324755VH551593N`) in the PayPal developer dashboard.
