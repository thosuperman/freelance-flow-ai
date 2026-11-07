# Deployment

One production demo environment (Vercel + managed PostgreSQL) plus local development. No staging, Kubernetes or microservices.

## 1. Database

Create a managed PostgreSQL 14+ database (for example Neon, Supabase, Vercel Postgres or RDS) and copy its connection string. For serverless, use the provider's pooled connection URL.

## 2. Vercel project

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js). The build command `npm run build` runs `prisma generate && next build`.
2. Set environment variables (Production):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | managed Postgres URL |
   | `APP_URL` | `https://<your-domain>` |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` |
   | `ANTHROPIC_API_KEY` | your key |
   | `PAYPAL_MODE` | `sandbox` for the hackathon demo (`mock` is refused in production) |
   | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Sandbox app credentials |
   | `PAYPAL_WEBHOOK_ID` | from the webhook you create in step 4 |
   | `CRON_SECRET` | random string |
   | `DEMO_MODE_ENABLED` | `true` |

3. Apply migrations against the production database, once per schema change:
   ```bash
   DATABASE_URL="<prod url>" npx prisma migrate deploy
   ```
4. Create the PayPal webhook pointing to `https://<your-domain>/api/webhooks/paypal` (see [PAYPAL_INTEGRATION.md](PAYPAL_INTEGRATION.md#sandbox-setup)), then set `PAYPAL_WEBHOOK_ID` and redeploy.
5. `vercel.json` schedules `/api/cron/cleanup-demo` daily; Vercel sends `Authorization: Bearer $CRON_SECRET`.

## 3. Smoke test

- `GET /api/health` returns `{"status":"ok","database":"ok","ai":{"provider":"anthropic",...},"paypal":{"mode":"sandbox","configured":true,"webhook":true}}`.
- Run the [manual Sandbox verification](PAYPAL_INTEGRATION.md#manual-sandbox-verification) on the deployed URL.

## Notes

- Never commit `.env`. Only `.env.example` is tracked.
- Switching to live payments means `PAYPAL_MODE=live` with live credentials and a live webhook. Do that only after a security review and the CSP work in [SECURITY.md](SECURITY.md).

**Status:** not deployed publicly as part of this build. Public deployment needs your authorization and accounts.
