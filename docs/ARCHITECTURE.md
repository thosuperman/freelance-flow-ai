# Architecture

FreelanceFlow AI is a **modular monolith**: one Next.js application with clear domain boundaries. Every authorization decision, money calculation and payment operation runs on the server.

```
Browser (freelancer)        Browser (client portal)            PayPal
   │ server actions            │ server actions / JSON routes     │  Orders v2, Webhooks
   ▼                           ▼                                  ▼
┌──────────────────────────── Next.js (App Router) ───────────────────────────┐
│ src/app            routes, layouts, route handlers (API, webhooks, cron)      │
│ src/components     UI (shadcn/ui primitives + feature components)             │
│ src/features       domain services: projects · proposals · milestones ·       │
│                    scope-changes · payments · ai · clients · portal · audit   │
│ src/lib            infrastructure: db · ai (provider, prompts, schemas) ·     │
│                    paypal (http + mock gateways) · money · security · errors  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       ▼
                                  PostgreSQL (Prisma)
```

## Directory map

| Path | Responsibility |
| --- | --- |
| `src/features/projects` | Project creation and editing, term validation, financial derivation (`financials.ts`), ownership checks (`access.ts`) |
| `src/features/proposals` | Proposal fields, **snapshot builder**, send/withdraw, client decision |
| `src/features/milestones` | Pure state machine (`rules.ts`) plus work actions and client review |
| `src/features/scope-changes` | Change-request state machine, creation, client decision and scope materialisation |
| `src/features/payments` | Payment requests, PayPal checkout, capture lock, `recordCapture`, reconciliation, webhooks |
| `src/features/ai` | AI orchestration, persistence of analyses, deterministic normalisation (`normalize.ts`) |
| `src/features/clients` | Tokenised portal access grants |
| `src/lib/paypal` | `PayPalGateway` interface, `HttpPayPalGateway` (Sandbox/Live), `MockPayPalGateway` (tests) |
| `src/lib/ai` | `AIProvider` interface, Claude provider, simulated provider, versioned prompts, Zod schemas |
| `src/lib/money.ts` | Decimal-safe, currency-aware money (minor units incl. JPY) |

## Domain model (key entities)

- **User / Session / Account**: Better Auth tables. **FreelancerProfile** stores business name, default currency, hourly rate and demo flags.
- **Client**: belongs to a freelancer.
- **Project**: has `status` DRAFT → PROPOSED → ACTIVE → COMPLETED. It holds the *intended* `budget`. The agreed value always comes from the approved proposal version.
- **ScopeItem**: a deliverable or exclusion, with `origin` PROPOSAL or CHANGE_REQUEST.
- **Milestone**: `kind` (DEPOSIT, DELIVERY, CHANGE_ORDER), `termsStatus` (DRAFT/APPROVED), `workStatus` and `paymentStatus` kept **separately** so they cannot contradict each other.
- **Proposal → ProposalVersion**: each version holds an immutable JSON `snapshot`, its `termsHash` (SHA-256 of canonical JSON) and `totalAmount`.
- **ScopeChangeRequest**: DRAFT → PENDING_CLIENT → APPROVED / REJECTED / WITHDRAWN, with `termsHash` set when it is sent.
- **Approval**: append-only record of each client decision (actor name and email, grant, hash, amount, comment, user agent).
- **ClientAccessGrant**: SHA-256 token hash for lookup, AES-256-GCM ciphertext so the freelancer can copy the link again, expiry and revocation.
- **PaymentRequest → PaymentAttempt (PayPal order) → PaymentTransaction (PayPal capture)**.
- **WebhookEvent**: unique `eventId`. **AIAnalysis**: provider, model, prompt version, input, output, success. **AuditEvent**. **RateLimitBucket**.

## Invariants and how they are enforced

| Invariant | Enforcement |
| --- | --- |
| Financial terms are versioned | `ProposalVersion` rows with `@@unique([proposalId, version])` |
| An approved version is immutable | No code path updates `snapshot`. Approval re-hashes the stored snapshot **and** rebuilds it from the live terms, and both must equal `termsHash` (tamper detection, tested) |
| Terms cannot change while pending or after approval | `updateProjectTerms` runs only on DRAFT, checked again inside the transaction with `updateMany … where status = DRAFT` |
| An approved change request cannot be edited silently | State machine allows edits only in DRAFT. `termsHash` is fixed on send and verified on approval |
| The original scope is never overwritten | Approved changes add `ScopeItem(origin = CHANGE_REQUEST)` and a `CHANGE_ORDER` milestone. Nothing original is modified |
| Every payment links to an authorised request | `PaymentTransaction.paymentRequestId` / `attemptId` FKs; the order amount is copied from `PaymentRequest`, itself copied from an APPROVED milestone |
| At most one active payment request per milestone | `PaymentRequest.activeKey @unique` (set to the milestone id while active), a partial-uniqueness trick |
| A capture is recorded only once | `PaymentTransaction.providerCaptureId @unique`, plus `SELECT … FOR UPDATE` on the payment request |
| No double payment across several PayPal windows | Capture lock `PaymentRequest.captureLockId` taken under row lock. Only one attempt may capture (concurrency test) |
| Duplicate webhooks do not duplicate records | `WebhookEvent.eventId @unique`; duplicates are acknowledged without reprocessing |
| Totals come from authoritative records | `computeProjectFinancials` (pure): approved version total + APPROVED change requests; paid = COMPLETED captures only |
| Currencies are never mixed | Every amount carries its currency; dashboard totals are grouped per currency; `computeProjectFinancials` throws on a mismatch |
| No floating-point money | `DECIMAL(14,2)` columns, `decimal.js` arithmetic, integer-cent rounding per currency |

## Key decisions

- **Modular monolith on Next.js.** One deployable unit and one database. Server actions for authenticated mutations; JSON route handlers only where the PayPal JS SDK needs `fetch` callbacks.
- **Pure rule modules** (`milestones/rules.ts`, `scope-changes/rules.ts`, `projects/financials.ts`) hold the business decisions so they are trivially unit-testable and AI can never bypass them.
- **Gateway interfaces** for PayPal and AI. The mock PayPal gateway uses the same interface as the real REST client, so every payment code path runs in tests. Adding Stripe, Gemini and so on means implementing an interface.
- **Prisma 6** instead of the newer 7/8 lines, for stability during a short build window.
- **Better Auth** for email/password with database sessions (httpOnly cookies), built-in rate limiting and origin checks.
- **Tokenised client portal** instead of client accounts, to keep the client experience frictionless. Tokens are 256-bit, project-scoped, revocable and expiring; approvals are bound to specific version hashes.

## Extension points (not implemented)

- Organizations and agency teams: add `Organization` and move `ownerId` to `organizationId` with membership roles.
- Subscriptions: PayPal Subscriptions API for SaaS billing, separate from client payments.
- Other providers: implement `PayPalGateway`-like interfaces per provider.
- More languages: UI copy is centralised per component; AI prompts already accept any input language.
