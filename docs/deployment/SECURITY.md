# Production security

Application-level controls (authorization, payments, webhooks, AI guardrails) are described in [../SECURITY.md](../SECURITY.md). This page covers the deployment.

## Network

| Port | Exposure |
| --- | --- |
| 80, 443 (TCP), 443 (UDP, HTTP/3) | Public (IPv4 and IPv6) |
| 22 | Only the admin IP recorded at provisioning (`106.73.59.96/32`) and the Lightsail browser console (`lightsail-connect`) |
| 3000 (app), 5432 (PostgreSQL) | Not published on the host. Verified closed from the internet |

PostgreSQL is on a Docker network marked `internal`, so it has no route to the internet either.

If your admin IP changes, re-run `deploy/provision.sh` (it updates the firewall with your current IP), or set it explicitly with `ADMIN_CIDR=x.x.x.x/32 deploy/provision.sh`.

## Host

- SSH key authentication only (Lightsail default; no passwords).
- Ubuntu `unattended-upgrades` installs security updates. The instance was fully updated and rebooted into the new kernel on 2026-11-07.
- Docker and journald log sizes are capped.
- The app container runs as the unprivileged `node` user, with a 900 MB memory limit.

## Secrets

- Production secrets exist only in `/opt/freelanceflow/.env.production` (mode `600`).
- `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` and the database password were generated fresh for production.
- The Docker image contains no `.env` files and needs no build-time secrets (verified with `ls` inside the running container).
- The Anthropic key and PayPal secret are read only by server code (`server-only` modules). The PayPal client ID is public by design.
- AWS credentials are in the admin machine's `~/.aws` profile, not in the repo, the image or the server.

## Payments and AI in production

- `PAYPAL_MODE=sandbox`. `APP_ENV=production` makes the app refuse `PAYPAL_MODE=mock`, and the mock approval endpoint returns 404 outside mock mode.
- No live PayPal credentials exist anywhere in the deployment.
- AI usage is limited per user (20 per 10 minutes), per demo workspace (25 total) and site-wide (`AI_DAILY_LIMIT` per 24 h). The site-wide limit shows a clear message when reached.
- New demo workspaces are limited per IP per hour; Caddy guarantees the IP is real.

## Public demo isolation

Each `/demo` visit creates a separate user with its own workspace. Every query is scoped by owner, and not-owned resources look like "not found". Integration tests cover cross-user and cross-project access. Expired demo workspaces are deleted hourly.

## Not in place

- No WAF or DDoS protection beyond Lightsail's network defaults.
- No Content-Security-Policy yet (see [../SECURITY.md](../SECURITY.md#known-limitations)).
- No off-instance backups.
