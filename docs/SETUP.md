# Setup

## Requirements

- Node.js ≥ 20.9 (developed on Node 24)
- Docker (for local PostgreSQL), or any PostgreSQL 14+ database
- Optional: an Anthropic API key, and PayPal Sandbox REST app credentials

## Install

```bash
npm install
cp .env.example .env
```

If your npm version gates install scripts, approve Prisma's: `npm install-scripts approve prisma @prisma/client @prisma/engines`.

Generate secrets:

```bash
openssl rand -base64 32   # → BETTER_AUTH_SECRET
openssl rand -base64 32   # → APP_ENCRYPTION_KEY (must decode to exactly 32 bytes)
```

## Database

```bash
npm run db:up        # docker compose: postgres:16 on localhost:54329 (creates freelanceflow, _test, _e2e)
npm run db:deploy    # apply migrations
npm run db:seed      # optional: fictional sample workspace
```

The seed prints its **test** sign-in (`sample@freelanceflow.test` / `sample-password-2026`). It creates no payments.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes | Public base URL (portal links, auth origin) |
| `BETTER_AUTH_SECRET` | yes | Session signing secret |
| `APP_ENCRYPTION_KEY` | yes | 32-byte base64 key for portal-token encryption |
| `AI_PROVIDER` | no | `anthropic` or `simulated`. Default: anthropic if a key is set |
| `ANTHROPIC_API_KEY` | for real AI | Anthropic API key |
| `AI_MODEL` | no | Default `claude-opus-5-5` |
| `AI_TIMEOUT_MS` | no | Default 90000 |
| `PAYPAL_MODE` | yes | `sandbox`, `live` or `mock` (tests only; refused when `APP_ENV=production` or `VERCEL_ENV=production`) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | sandbox/live | REST app credentials (server only) |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | sandbox/live | Same client id for the PayPal JS SDK (public by design) |
| `PAYPAL_WEBHOOK_ID` | sandbox/live | Webhook id used for signature verification |
| `DEMO_MODE_ENABLED` | no | `false` disables `/demo` |
| `DEMO_RATE_LIMIT_PER_HOUR` | no | Demo workspaces per IP per hour (default 8) |
| `CRON_SECRET` | prod | Protects `/api/cron/cleanup-demo` |

## Configure the AI provider

1. Create an API key in the Anthropic Console.
2. Set `ANTHROPIC_API_KEY=...` (and optionally `AI_PROVIDER=anthropic`).
3. Restart `npm run dev`. The amber "AI: simulated" banner disappears, and **Settings → Integrations** shows "AI: Claude (claude-opus-5-5)".

Without a key, the app uses the simulated provider. Its output is labelled **Simulated AI** everywhere and stored with `provider = "simulated"`.

## Configure PayPal Sandbox

See [PAYPAL_INTEGRATION.md](PAYPAL_INTEGRATION.md#sandbox-setup).

## Run

```bash
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration   # uses freelanceflow_test (truncated between tests)
npm run test:e2e           # builds into .next-e2e and runs on :3100 against freelanceflow_e2e
```

The first `test:e2e` run needs Playwright browsers: `npx playwright install chromium`.
