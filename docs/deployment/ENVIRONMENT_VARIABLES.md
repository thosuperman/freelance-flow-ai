# Production environment variables

The server reads `/opt/freelanceflow/.env.production` (mode `600`, owner `ubuntu`). It is never committed, never copied into the Docker image (`.dockerignore` excludes `.env*`), and no value is needed at build time. The template is [.env.production.example](../../.env.production.example).

| Variable | Production value | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | Blocks `PAYPAL_MODE=mock` |
| `APP_DOMAIN` | `freelanceflow.hayaix.tech` | Caddy certificate and site address |
| `APP_URL` | `https://freelanceflow.hayaix.tech` | Better Auth base URL and trusted origin, client portal links |
| `APP_IMAGE` | set by `release.sh` | The image the stack runs (`freelanceflow-app:<git-sha>-<timestamp>`) |
| `POSTGRES_PASSWORD` | random hex | Database password; `compose.prod.yml` builds `DATABASE_URL` from it (`?connection_limit=5`) |
| `BETTER_AUTH_SECRET` | random, 32 bytes | Session signing. **Different from local development** |
| `APP_ENCRYPTION_KEY` | random, 32 bytes base64 | Encrypts stored portal tokens. **Different from local development** |
| `AI_PROVIDER` | `anthropic` | Live Claude |
| `ANTHROPIC_API_KEY` | secret | Server-only |
| `AI_MODEL` | `claude-sonnet-5-5` | Same model verified locally |
| `AI_TIMEOUT_MS` | `90000` | Per-request timeout (the SDK also retries twice) |
| `AI_DAILY_LIMIT` | `400` | Site-wide cap on AI calls per 24 h |
| `AI_STUDIO_DAILY_TURNS` | unset (default 800) | Site-wide cap on AG Studio assistant turns per 24 h (one question can take several turns) |
| `AG_STUDIO_LICENSE_KEY` | unset | Optional AG Studio licence or trial key; without it AG Studio runs as a watermarked trial |
| `PAYPAL_MODE` | `sandbox` | **Never `live` for the hackathon** |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Sandbox app credentials | Secret stays server-side; the client ID is sent to the browser for the PayPal JS SDK |
| `PAYPAL_ORDERS_CLIENT` | unset (`sdk`) | Orders via the PayPal Server SDK (default) or `rest` for the hand-written client |
| `PAYPAL_WEBHOOK_ID` | `12324755VH551593N` | The production webhook (separate from the ngrok one used locally) |
| `DEMO_MODE_ENABLED` | `true` | Enables `/demo` |
| `DEMO_RATE_LIMIT_PER_HOUR` | `8` | New demo workspaces per IP per hour |
| `CRON_SECRET` | random | Protects `/api/cron/cleanup-demo`; the cron job reads it from inside the container |

Set by `compose.prod.yml`, not the env file: `NODE_ENV=production`, `DATABASE_URL`, `NODE_OPTIONS=--max-old-space-size=512`.

`NEXT_PUBLIC_PAYPAL_CLIENT_ID` is not needed in production: the server falls back to `PAYPAL_CLIENT_ID` at runtime.

## Changing a value

```bash
ssh -i ~/.ssh/freelanceflow-prod ubuntu@184.195.111.183
cd /opt/freelanceflow && nano .env.production
docker compose -f compose.prod.yml --env-file .env.production up -d app   # recreates the app with the new env
```

Rotating `BETTER_AUTH_SECRET` signs everyone out. Rotating `APP_ENCRYPTION_KEY` makes stored portal links impossible to re-display (freelancers can regenerate them).
