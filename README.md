# FreelanceFlow AI

**From conversation to contract. From work to payment.**

FreelanceFlow AI turns messy client conversations into clear agreements, approved milestones and PayPal payments, and uses AI to catch scope creep before freelancers end up working for free.

> AI understands the work. Humans approve the agreement. PayPal handles the payment. FreelanceFlow protects the freelancer.

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/).

**Try it:** <https://freelanceflow.hayaix.tech/demo> creates a private demo workspace (live Claude, PayPal Sandbox; no real money moves).

---

## What it does

| Step | What happens | Who decides |
| --- | --- | --- |
| 1. Paste a conversation | AI (Claude, structured outputs) extracts deliverables, exclusions, budget, milestones, timeline, assumptions, ambiguities and missing info | AI suggests |
| 2. Review | An editable review screen. Every AI assumption has to be accepted or rejected, and milestones must add up exactly to the project value | Freelancer |
| 3. Proposal | AI drafts the proposal text. Prices come only from the milestones. Sending freezes an **immutable, SHA-256-hashed version** | Freelancer |
| 4. Client approval | The client opens a private, revocable portal link and approves that exact version. Name, time, version hash and amount are recorded | Client |
| 5. PayPal payment | A milestone becomes a payment request. The server creates a PayPal order from the stored amount, captures it, verifies amount, currency and reference, then records it once | Client pays, server verifies |
| 6. Scope protection | A new client request is compared with the approved scope. The result cites the exact deliverables or exclusions (`D1`, `E4`…) it relied on. Out-of-scope work becomes a change request priced from the freelancer's hourly rate | AI explains, freelancer prices |
| 7. Change approval | The client approves the change request. The original agreement is preserved, new scope items and a change-order milestone are added, and totals update | Client |
| 8. Financials | Original contract, approved changes, revised value, paid and outstanding amounts. All derived from persisted records, never mixed across currencies | Deterministic code |
| 9. Smart timeline | A Bryntum Gantt from approved milestones, PayPal payments and approved change requests: agreed baseline, payment dependencies, late and at-risk flags, and an AI schedule explanation that never moves commitments | Code computes, AI explains |
| 10. Financial Intelligence | AG Studio dashboards (revenue, payment risk, scope-change impact) per currency, with Studio's agents running on Claude and a grounded "Ask your finances" | Code computes, AI explains |

## For judges: testing the live demo

1. Open **https://freelanceflow.hayaix.tech/demo** and click **Start my demo workspace**. No account or password is needed, and each visitor gets a private workspace for 24 hours.
2. Follow the 12 steps on that page. The guided "Next step" card on each project leads the way, and AI runs on live Claude.
3. To pay as the client, open the client portal link from the project, click **Pay with PayPal**, and sign in with a **PayPal Sandbox Personal (buyer) account**. The submission's testing instructions give a dedicated Sandbox buyer login, or use your own from developer.paypal.com → Testing Tools → Sandbox Accounts. No real money moves.
4. The **Smart timeline** tab (Bryntum Gantt) and **Financial Intelligence** in the sidebar (AG Studio) show the same records.

Bryntum Gantt and AG Studio run as vendor trials, so they show a watermark.

## Quick start (local)

```bash
cp .env.example .env            # then fill BETTER_AUTH_SECRET and APP_ENCRYPTION_KEY (openssl rand -base64 32)
npm install
npm run db:up                   # Postgres 16 in Docker on :54329
npm run db:deploy               # apply migrations
npm run db:seed                 # optional fictional sample workspace
npm run dev                     # http://localhost:3000
```

Open <http://localhost:3000/demo> and click **Start my demo workspace** for the guided three-minute story.

With no `ANTHROPIC_API_KEY`, AI runs on a **clearly labelled simulated** heuristic provider. With `PAYPAL_MODE=mock`, checkout uses a **clearly labelled simulated** PayPal gateway. For real Claude and PayPal Sandbox, see [docs/SETUP.md](docs/SETUP.md) and [docs/PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md).

## Tests

```bash
npm run test:unit          # money, rules, AI schemas and heuristics, components (Vitest + RTL)
npm run test:integration   # real Postgres: approvals, authorization, payments, webhooks, reconciliation
npm run test:e2e           # Playwright on a production build: full demo story, auth, milestones, mobile
```

Automated payment tests use mocks. **They are not proof of a live PayPal Sandbox transaction.** The manual Sandbox procedure is in [docs/PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md#manual-sandbox-verification).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · React Hook Form · Zod 4 · Prisma 6 · PostgreSQL 16 · Better Auth · Anthropic SDK (Claude Opus 5.5, structured outputs) · PayPal Orders v2 REST + PayPal JS SDK · decimal.js · Vitest · React Testing Library · Playwright

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): domain model, invariants, decisions
- [docs/SETUP.md](docs/SETUP.md): local setup and configuration
- [docs/PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md): which PayPal APIs are used and why, idempotency, webhooks, Sandbox procedure
- [docs/AI_DESIGN.md](docs/AI_DESIGN.md): prompts, schemas, guardrails, simulated fallback
- [docs/SECURITY.md](docs/SECURITY.md): threat model and controls
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/deployment/](docs/deployment/): AWS Lightsail production runbook
- [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md): guided demo for judges
- [docs/sponsors/](docs/sponsors/): Bryntum, AG Grid (AG Studio) and APIMatic integrations, documented honestly
- [submission/](submission/): Devpost package

## Status and limitations

See [submission/release-checklist.md](submission/release-checklist.md) for the honest definition-of-done status. In short:

- ✅ Implemented and covered by automated tests: the whole workflow, authorization boundaries, payment idempotency, webhook verification paths and reconciliation.
- ✅ **Verified live on 2026-11-07:** Claude extraction, proposal drafting and scope detection against the real API, and a genuine PayPal Sandbox checkout. In that checkout the $450.00 capture was confirmed with PayPal's API, and both webhooks were delivered, signature-verified and processed once. Details are in [docs/PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md#manual-sandbox-verification) and [docs/AI_DESIGN.md](docs/AI_DESIGN.md#verification-status).
- ✅ Deployed at **https://freelanceflow.hayaix.tech** (AWS Lightsail, us-east-1) with live Claude and PayPal Sandbox. See [docs/deployment/](docs/deployment/).
- Approvals are recorded as auditable consent; they are **not** qualified electronic signatures.
- Single freelancer per workspace. Teams, organizations, subscriptions, other payment providers and other languages are architectural extension points, not features.

## License

[MIT](LICENSE) for this repository's code. Third-party packages keep their own licences: Bryntum Gantt and AG Studio are commercial products used here under their free trials and installed from npm; none of their code is committed.
