# APIMatic: PayPal Server SDK via the Context Plugin

## What the sponsor asks for

From the [APIMatic sponsor page](https://paypalaihackathon.devpost.com/details/apimatic) (read 2026-11-08):

- APIMatic offers **Context Plugins** that give AI coding agents (Claude Code, Cursor, VS Code) PayPal API context.
- The sponsor page offers subscriptions: 1 month of APIMatic Basic for participants who used the Context Plugin to build their PayPal integration, and 6 months of APIMatic Business for winning teams that used it. Claims go through APIMatic's Google Form.
- The **Official Rules** (section 8, read 2026-11-08) also list a judged **"Best Use of APIMatic"** prize: 3 × USD 1,000 plus 6 months of APIMatic Business, for "all eligible submissions that use any APIMatic tools".
- The resource PDF gives the install command: `npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview`.

## How it was used

The plugin ([paypaldev/server-sdk-context-plugin-preview](https://github.com/paypaldev/server-sdk-context-plugin-preview), commit `6aa0571`, "preview, experimental for the hackathon") is a set of agent skills for the **APIMatic-generated PayPal Server SDK** (`@paypal/paypal-server-sdk`). This build used its TypeScript skills: `typescript-getting-started`, `typescript-error-handling`, `typescript-configuration-resilience`, `typescript-calling-endpoints`, `typescript-models` and `typescript-testing`.

**Honest note on installation:** the coding agent's sandbox blocked running the third-party installer (`npx context-plugins install …`), so the plugin was not registered in the agent's configuration. The skill files are plain Markdown in PayPal's public repository. The agent read them directly from GitHub and followed them step by step, which is the same content the installer would have put in place. To register the plugin yourself:

```bash
npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview
```

## What changed because of it

The Orders v2 calls now go through the official, APIMatic-generated SDK instead of hand-written `fetch` calls. They sit behind the existing `PayPalGateway` interface, so payment logic, idempotency rules and tests are unchanged.

| File | Change |
| --- | --- |
| [src/lib/paypal/sdk-gateway.ts](../../src/lib/paypal/sdk-gateway.ts) | `SdkPayPalGateway`: `createOrder`, `getOrder` and `captureOrder` through `OrdersController` from `@paypal/paypal-server-sdk@2.5.0` (pinned exactly, as the skill says) |
| [src/lib/paypal/index.ts](../../src/lib/paypal/index.ts) | The SDK gateway is the default; `PAYPAL_ORDERS_CLIENT=rest` switches back to the REST client. Webhook verification stays on REST because the SDK has no Webhooks controller |
| [tests/unit/paypal-sdk-gateway.test.ts](../../tests/unit/paypal-sdk-gateway.test.ts) | 7 tests: model mapping, server-side amount and idempotency key on create, capture key, error mapping (typed and raw-body), missing-id rejection, webhook delegation |

Findings from the skills, each confirmed against the SDK source in `node_modules`:

1. **Timeouts:** `DEFAULT_CONFIGURATION.timeout` is `0`, meaning a call can wait forever (configuration-resilience skill). The gateway sets a 20 s per-attempt timeout.
2. **Retries:** `DEFAULT_RETRY_CONFIG` retries only `GET`/`PUT`, and with `maximumRetryWaitTime: 0` it effectively never retries. Create and capture send `PayPal-Request-Id`, which makes a `POST` retry idempotent at PayPal, so `POST` is added with a bounded backoff (2 retries, 10 s budget).
3. **Token exchange:** the per-attempt timeout does not cover the OAuth token exchange (configuration-resilience skill). Every call is also raced against a 45 s overall deadline.
4. **Error classes:** the typed `CustomError` is **not exported** from the package root, so `instanceof CustomError` is impossible. Following the error-handling skill's fallback, errors are recognised as `ApiError` and read from `statusCode` plus the **snake_case** `result` payload (`debug_id`, `details[].issue`), with the raw body as a fallback.
5. **Model gap:** the SDK's `OrdersCapture` model has no `supplementary_data`. We checked that nothing on the capture-response path needs it; the webhook handler reads the order ID from the raw event JSON.

## Verification

| Check | Result |
| --- | --- |
| Unit tests | 7/7 pass (full suite 101/101) |
| Live PayPal Sandbox through the SDK gateway (2026-11-08) | Created order `7MB18005N4451582B` (USD 12.34, `custom_id` set). Replaying the same `PayPal-Request-Id` returned **the same order** (idempotent). `getOrder` returned it. An unknown ID was mapped to `PayPalApiError` 404 `INVALID_RESOURCE_ID` with a debug ID |
| Full checkout (buyer approval and capture) through the SDK gateway | Deployed to production. A buyer approval in the PayPal popup is needed to complete it; see [deployment/PAYPAL_SANDBOX.md](../deployment/PAYPAL_SANDBOX.md) |

The earlier verified Sandbox capture (`4L223070M78934542`, 2026-11-07) used the REST client. That client is still available with `PAYPAL_ORDERS_CLIENT=rest`.

## Remaining user action

- Select **Best Use of APIMatic** on the Devpost form if you want to compete for it. Our usage is real but modest: the SDK adoption and resilience fixes, not a large APIMatic-specific feature.
- Claim the APIMatic participant subscription with their form, if you want it.
- Optionally register the plugin with the install command above.
