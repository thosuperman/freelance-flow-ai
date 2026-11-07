# PayPal integration

## Which PayPal APIs are used, and why

| API | Used for | Why this API |
| --- | --- | --- |
| **OAuth 2.0** `POST /v1/oauth2/token` | Server-to-server access token (client credentials), cached until shortly before expiry | Required for all REST calls |
| **Orders v2** `POST /v2/checkout/orders` | One order per checkout attempt, `intent: CAPTURE`, amount taken from the stored payment request | Orders is PayPal's API for buyer-approved, merchant-captured one-off payments. It fits milestone payments, where the client pays a specific approved amount now |
| **Orders v2** `POST /v2/checkout/orders/{id}/capture` | Capture after buyer approval, with `PayPal-Request-Id` idempotency | Server-side capture lets us verify the result before recording anything |
| **Orders v2** `GET /v2/checkout/orders/{id}` | Reconciliation after timeouts, closed tabs and `ORDER_ALREADY_CAPTURED` | Authoritative provider state |
| **Webhooks** `POST /v1/notifications/verify-webhook-signature` | Verify every incoming webhook before processing | PayPal's supported verification method |
| **PayPal JS SDK** (`@paypal/react-paypal-js`, Smart Buttons) | Buyer approval popup in the client portal | Official buyer UI. The browser only ever receives the public client id |

**Deliberately not used:**

- **Invoicing API**: it sends PayPal-hosted invoices by email. FreelanceFlow's value is *agreement-bound* milestone payments inside its own client portal, where the server controls the amount and verification.
- **Payouts API**: used for sending money out (marketplace disbursements), which is not this flow.
- **Subscriptions API**: covers recurring billing. A future candidate for SaaS plan billing, but not for client payments.

## Payment flow

```
Freelancer: approved milestone ──▶ PaymentRequest (amount & currency copied from milestone, immutable)
Client portal: "Pay with PayPal"
  createOrder ──▶ POST /api/portal/:token/payments/:id/order
                   server: grant ✓, request OPEN ✓, no capture in progress ✓
                   PayPal: create order { custom_id = request id, amount = stored amount } (PayPal-Request-Id)
                   persist PaymentAttempt(providerOrderId)
  buyer approves in PayPal popup
  onApprove ──▶ POST /api/portal/:token/payments/:id/capture { orderId }
                   server: attempt belongs to request ✓
                   acquire capture lock (row lock + captureLockId)
                   PayPal: capture (PayPal-Request-Id = ff-capture-<attempt>)
                   verify: capture.amount == stored amount, currency, custom_id
                   recordCapture (transaction): PaymentTransaction (unique capture id)
                                                PaymentRequest PAID, Milestone PAID, audit
Webhooks ──▶ POST /api/webhooks/paypal  (verified → stored once → same recordCapture path)
```

The browser never sends an amount. The order endpoint ignores its request body entirely.

## Failure handling

| Situation | Behaviour |
| --- | --- |
| Double click / refresh after success | The attempt is already COMPLETED, so the response is `ALREADY_PAID`. No second capture, no second record |
| Two PayPal windows approved | The capture lock lets only one attempt capture. The other gets `409 CONFLICT` and is never captured (tested concurrently) |
| Network timeout during capture | The lock is kept and the error is recorded. Reconciliation (`GET order`) on the next portal/project page load, the status endpoint, or the `CHECKOUT.ORDER.APPROVED` webhook determines the real state (tested) |
| `ORDER_ALREADY_CAPTURED` | Fetch the order and record its capture |
| `INSTRUMENT_DECLINED` | Lock released; the client is sent back to PayPal (`actions.restart()`) |
| Capture `PENDING` | Transaction PENDING, request PROCESSING, **not counted as paid**. `PAYMENT.CAPTURE.COMPLETED` webhook completes it (tested) |
| Capture `DECLINED` / `PAYMENT.CAPTURE.DENIED` | Attempt FAILED, request reopened for another try |
| Amount or currency mismatch | Not recorded as paid; attempt FAILED; audit `payment.verification_failed` (tested) |
| Cancelled checkout | Attempt marked CANCELLED; nothing charged |
| Duplicate webhook | Unique `eventId` → acknowledged as duplicate, not reprocessed (tested) |
| Invalid webhook signature | `400`, nothing stored (tested) |
| Webhook processing error | Stored as FAILED and returns `500` so PayPal retries; processing is idempotent |
| Refund / reversal webhook | Transaction REFUNDED, milestone UNPAID, paid total decreases (tested). Refunds themselves are only ever issued by a human in PayPal |

## Sandbox setup

1. Sign in at <https://developer.paypal.com/> → **Apps & Credentials** → **Sandbox** → **Create App** (type: Merchant).
2. Copy the **Client ID** and **Secret**:
   ```env
   PAYPAL_MODE="sandbox"
   PAYPAL_CLIENT_ID="<sandbox client id>"
   PAYPAL_CLIENT_SECRET="<sandbox secret>"
   NEXT_PUBLIC_PAYPAL_CLIENT_ID="<sandbox client id>"
   ```
3. **Sandbox accounts** (Testing Tools → Sandbox Accounts): PayPal creates a default *Business* (merchant) and *Personal* (buyer) account. Payments land in the business account that owns the app. Sign in to the PayPal popup with the **Personal** account's email and generated password (shown under "View/edit account").
4. **Webhook**: in your app → **Add Webhook**. URL: `https://<your-domain>/api/webhooks/paypal` (PayPal needs a public HTTPS URL; for local testing, use a tunnel such as `ngrok http 3000` and set `APP_URL` to it). Subscribe to:
   `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`.
   Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`.
5. Restart the app. **Settings → Integrations** should show "PayPal Sandbox — Orders v2" and "PayPal webhooks: signature verification enabled".

## Manual Sandbox verification

Run this once with real Sandbox credentials before submitting, and record the result in `submission/release-checklist.md`.

1. Start the app with `PAYPAL_MODE=sandbox` and the credentials above.
2. `/demo` → **Start my demo workspace** → analyse the example → accept assumptions → **Confirm project**.
3. **Draft with AI** → **Send to client** → **Client portal** → **Review proposal** → tick the confirmation → **Approve proposal**.
4. As the freelancer, **Request payment** on *Upfront deposit* ($450.00).
5. In the portal, **Pay with PayPal** → the PayPal Sandbox popup opens → sign in as the sandbox *Personal* account → **Pay**.
6. Expect a redirect to the receipt with a PayPal capture ID and the "PayPal Sandbox" tag.
7. Cross-check: in <https://www.sandbox.paypal.com/> (business account) the $450.00 payment appears with the same transaction ID, and in the developer dashboard → Webhooks → *Event logs*, `PAYMENT.CAPTURE.COMPLETED` was delivered with 200. In the database, `WebhookEvent` has `status = PROCESSED` and `PaymentTransaction.verifiedVia = CAPTURE_RESPONSE`.
8. Optional resilience checks:
   - Close the tab right after approving in the popup → reload the portal: the payment is reconciled (or captured by the `CHECKOUT.ORDER.APPROVED` webhook).
   - Resend the same webhook from the dashboard → the response says `duplicate`, and no extra transaction is created.
   - Refund the payment from the sandbox business account → the project's "Payments received" drops back.

**Current status: verified live in PayPal Sandbox on 2026-11-07** (local dev server reached through an ngrok HTTPS tunnel). Steps 1–7 passed:

| Check | Result |
| --- | --- |
| Order | `2TY00931XK2249302`, intent `CAPTURE`, status `COMPLETED`, `custom_id` = the payment request id |
| Capture | `4L223070M78934542`, `COMPLETED`, USD 450.00, `final_capture: true` (PayPal fee 16.20, net 433.80), confirmed independently with `GET /v2/payments/captures/{id}` |
| App records | Payment request `PAID`; exactly one `PaymentTransaction` (`verifiedVia = CAPTURE_RESPONSE`, environment `sandbox`); attempt `COMPLETED` |
| Webhooks | `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` delivered (HTTP 200), signatures verified with `verify-webhook-signature`, stored `PROCESSED` without creating a second transaction |
| Client view | Receipt shows the capture ID and "PayPal Sandbox"; dashboard shows $450.00 paid, $1,050.00 outstanding |

The optional resilience checks in step 8 (closed tab, webhook resend, refund) have not been run live yet. They are covered by the mocked integration tests, which are not proof of live behaviour.

## Simulated mode (`PAYPAL_MODE=mock`)

An in-process gateway that mimics Orders v2 semantics, for automated tests and offline development. The checkout shows a dashed amber **Simulated PayPal checkout** panel, and every resulting record has `environment = "mock"`, shown as **Simulated PayPal** on receipts, payment tables and the dashboard. The mode is refused at startup when `VERCEL_ENV=production`.
