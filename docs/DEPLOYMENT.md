# Deployment

**Live:** https://freelanceflow.hayaix.tech, running on one Amazon Lightsail instance in `us-east-1` (USD 12/month) with Caddy, the Next.js app and PostgreSQL in Docker Compose.

The full runbook is in [docs/deployment/](deployment/):

| Guide | Contents |
| --- | --- |
| [AWS_LIGHTSAIL.md](deployment/AWS_LIGHTSAIL.md) | Architecture, resources, commands, measurements, teardown |
| [COST_ESTIMATE.md](deployment/COST_ESTIMATE.md) | Monthly cost and what is deliberately not used |
| [DOMAIN_AND_HTTPS.md](deployment/DOMAIN_AND_HTTPS.md) | Route 53 record, Let's Encrypt via Caddy, verification |
| [ENVIRONMENT_VARIABLES.md](deployment/ENVIRONMENT_VARIABLES.md) | Every production variable |
| [PAYPAL_SANDBOX.md](deployment/PAYPAL_SANDBOX.md) | Production webhook and payment verification |
| [DATABASE_BACKUP.md](deployment/DATABASE_BACKUP.md) | Migrations, backups, restore |
| [UPDATE_AND_ROLLBACK.md](deployment/UPDATE_AND_ROLLBACK.md) | `deploy/deploy.sh`, rollback, restart |
| [SECURITY.md](deployment/SECURITY.md) | Firewall, secrets, host hardening |
| [TROUBLESHOOTING.md](deployment/TROUBLESHOOTING.md) | Common failures and fixes |

Quick reference:

```bash
deploy/provision.sh      # create/verify AWS resources (idempotent)
deploy/deploy.sh         # test, build, ship, migrate, release with auto-rollback
```

## Other platforms

The app is a standard Next.js server with PostgreSQL, so it also runs on platforms such as Vercel with a managed database. In that case, set the variables from [.env.production.example](../.env.production.example) (without the Caddy and compose-specific ones), run `prisma migrate deploy` against the database, and point the PayPal webhook at `https://<domain>/api/webhooks/paypal`. `vercel.json` schedules the demo cleanup cron there. That path is not the one in use and has not been tested.
