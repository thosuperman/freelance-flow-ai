# PayPal Sandbox in production

Production uses **PayPal Sandbox only** (`PAYPAL_MODE=sandbox`, API host `api-m.sandbox.paypal.com`). No real money moves. The general integration design is in [../PAYPAL_INTEGRATION.md](../PAYPAL_INTEGRATION.md).

## Configuration

| Setting | Value |
| --- | --- |
| Sandbox app | Same Merchant app as local development |
| Production webhook | `12324755VH551593N` → `https://freelanceflow.hayaix.tech/api/webhooks/paypal` |
| Events | `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED` |
| Local webhook (unchanged) | `4HC62226N9139954M` → the ngrok tunnel |

Both webhooks receive every event for the app. Each environment verifies the signature with its own webhook ID and ignores events for orders it doesn't know, so they don't interfere.

The production webhook was created with the PayPal REST API (`POST /v1/notifications/webhooks`).

## Return, cancel and confirmation URLs

The checkout uses the PayPal JS SDK popup (`PayPalButtons`), not redirect URLs. The browser calls the app's own endpoints, which are relative to the site origin:

- `POST /api/portal/{token}/payments/{id}/order`: the server creates the order with the amount from the payment request
- `POST /api/portal/{token}/payments/{id}/capture`: the server captures and verifies
- `POST /api/portal/{token}/payments/{id}/cancel`, `GET .../status`

Client-facing payment links come from `APP_URL`, which is the production domain. Nothing points at ngrok.

## Safety properties (unchanged from local, covered by automated tests)

- The server computes amounts; the order endpoint ignores the request body.
- Capture amount, currency and `custom_id` (payment request ID) must match before anything is marked paid.
- `PayPal-Request-Id` idempotency keys, a capture lock with row locking, a unique capture ID and a unique webhook event ID.
- Webhook signatures are verified with PayPal's `verify-webhook-signature` API using the raw request body.
- A redirect or browser callback alone never marks a payment as received.

## Verification status

| Step | Status |
| --- | --- |
| Live Claude project → proposal → client approval → payment request on production | ✅ Verified 2026-11-08 |
| PayPal Sandbox buttons render on the production payment page | ✅ Verified |
| Buyer approval in the PayPal popup | ⏳ Needs a human to sign in with the Sandbox Personal account |
| Capture, webhook delivery and dashboard update on production | ⏳ After the buyer approval |

The same flow was fully verified against Sandbox from the local build on 2026-11-07 (capture `4L223070M78934542`); see [../PAYPAL_INTEGRATION.md](../PAYPAL_INTEGRATION.md#manual-sandbox-verification).

## Checking a production payment

```bash
ssh -i ~/.ssh/freelanceflow-prod ubuntu@184.195.111.183
cd /opt/freelanceflow
docker compose -f compose.prod.yml --env-file .env.production exec db psql -U freelanceflow -d freelanceflow -c \
  'select "eventType", verified, status, "receivedAt" from "WebhookEvent" order by "receivedAt" desc limit 5;'
```
