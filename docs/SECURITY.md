# Security

## Threat model (MVP)

| Asset | Threat | Control |
| --- | --- | --- |
| Freelancer projects | Another user reads or modifies them | Every service call scopes queries by `ownerId`. Not-owned looks like not-found (no id probing). Tested |
| Client portal | Guessing or reusing links | 256-bit random tokens; only SHA-256 stored for lookup (plus AES-256-GCM ciphertext for re-copying); project-scoped; expiry (120 days); revocation and reissue; `noindex` and `no-store` headers; `Referrer-Policy: strict-origin-when-cross-origin` so the path never leaks |
| Agreed terms | Changed after approval; approval of a different version | Immutable snapshots, SHA-256 `termsHash` quoted on approval, stored-snapshot re-hash and live re-build check, conditional status updates. Tested |
| Payments | Browser manipulates amount | The server derives the amount from the payment request; the order endpoint ignores the body; capture amount, currency and `custom_id` verified. Tested |
| Payments | Double capture / replay | Capture lock + row lock, `PayPal-Request-Id` idempotency, unique capture id, unique webhook event id. Tested |
| Payments | Forged webhooks | PayPal `verify-webhook-signature` with the raw body; unverified → 400, not stored. Tested |
| Approvals | Freelancer approves on the client's behalf | Approval actions exist only on portal grants; state machine actor checks. Tested |
| AI | Prompt injection in client text | Untrusted-text wrapping, no tools, schema-only output, server-side validation of every value |
| Accounts | Credential stuffing | Better Auth rate limits (sign-in 10/min, sign-up 5/min), password length 8–128, hashed with scrypt |
| Endpoints | Abuse | DB-backed rate limits: AI (20/10 min/user), portal actions (30/min), payment routes (10–40/min), demo creation (per IP per hour) |
| CSRF | Cross-site state changes | Server actions: Next.js origin checks. JSON routes: strict `Origin` = `Host` check. Better Auth: origin validation |
| Secrets | Exposure to the browser | PayPal secret and AI key are server-only (`server-only` imports). Only the PayPal client id, public by design, is exposed |

## Other controls

- Strict input validation with Zod on every action and route; Zod errors become field-level messages.
- Errors: domain errors carry safe messages; unexpected errors are logged without payloads and shown generically.
- Logging: no card data (PayPal handles it), no tokens, no secrets. PayPal errors log only status, issue and `debug_id`.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `poweredByHeader: false`.
- Mock PayPal is refused when `VERCEL_ENV=production`; the mock approval endpoint returns 404 outside mock mode.
- Demo workspaces are isolated per visitor, expire after 24 h and are deleted by a cron endpoint protected with `CRON_SECRET` (constant-time comparison).
- Audit trail: append-only `AuditEvent` and `Approval` tables.

## Known limitations

- No Content-Security-Policy yet (the PayPal JS SDK needs several PayPal domains). Recommended next step: nonce-based CSP allowing `*.paypal.com`, `*.paypalobjects.com`.
- Email verification is not enforced at sign-up (no transactional email provider configured).
- Portal links are bearer credentials: anyone holding the link can act as the client. That is acceptable for an MVP; next step is optional email one-time-code confirmation before approvals and payments.
- Approvals are auditable consent records, **not** qualified electronic signatures.

## Reporting

Please report vulnerabilities privately to the maintainers rather than opening a public issue.
