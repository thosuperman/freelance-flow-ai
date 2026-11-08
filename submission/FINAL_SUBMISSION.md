# FreelanceFlow AI: final Devpost submission content

Ready to paste. Every claim below matches the deployed product as audited on 2026-11-08. Fields marked **[YOU]** need something only you can provide.

Devpost form fields were not visible without logging in. The list below follows Devpost's standard project form plus the Official Rules' requirements (§4). Check the actual form for any hackathon-specific questions.

---

## Project name

FreelanceFlow AI

## Elevator pitch / tagline (≤ 200 characters)

FreelanceFlow AI turns messy client messages into approved milestones and verified PayPal payments, and uses explainable AI to catch scope creep before freelancers work for free.

## Thumbnail

`submission/thumbnail.png` (1500×1000, 3:2)

## Image gallery

`submission/screenshots/01-landing.png` … `13-mobile-portal.png`, captured from the live site on 2026-11-08 (see the list at the end).

## Video demo link **[YOU]**

Public YouTube URL, under 3 minutes. Not recorded yet. Script: `submission/demo-script.md`.

## Try it out links

- Live demo: https://freelanceflow.hayaix.tech/demo
- Source code: https://github.com/thosuperman/freelance-flow-ai

---

## About the project

### Inspiration

Freelancers rarely lose money because they are bad at their craft. They lose it in the gaps: the budget agreed in a chat thread, the "quick extra" nobody priced, the final invoice sent three weeks late, the argument about what was actually agreed. Existing tools ask freelancers to re-type all of that into projects, invoices and payment schedules by hand.

We wanted the agreement itself to become the system of record. AI does the administrative work, while humans and PayPal stay in charge of commitments and money.

### What it does

1. **Conversation → project.** Paste a client message. Claude extracts deliverables, exclusions, budget, currency, timeline, milestones and acceptance criteria into a schema-validated draft. Every assumption the AI made must be accepted or rejected before the project can be confirmed, and milestone amounts are recomputed with exact decimal arithmetic.
2. **Proposal → immutable agreement.** AI drafts the proposal wording but never the prices. Sending freezes the terms into a SHA-256-hashed version, and the client approves *that exact version* in a private portal. We record who approved, when, the hash and the amount.
3. **Milestones → PayPal payments.** A milestone becomes a payment request. The server creates the PayPal order from the stored amount, captures it after buyer approval, verifies the amount, currency and reference, and records it exactly once. Signature-verified webhooks and reconciliation handle pending captures, closed tabs, timeouts, refunds and duplicates.
4. **Scope protection.** When the client asks "Can you also add a booking system?", FreelanceFlow compares the request with the approved scope and cites the exact deliverables and exclusions it relied on. Out-of-scope work becomes a change request priced from the freelancer's own hourly rate: AI estimates hours, code sets the price. After client approval, scope and totals update and the original agreement is preserved.
5. **Financial truth.** Original contract, approved changes, revised value, paid, outstanding and overdue, all derived from approved records and verified PayPal captures, and never mixed across currencies.
6. **Smart Milestone Timeline (Bryntum Gantt).** A read-only Gantt per project, built from approved milestones, PayPal payment requests and approved change requests:
   - the agreed plan as a baseline
   - payments as dependencies
   - late work or overdue payments flag everything downstream as at risk
   - Claude explains the risk and drafts a client message, but never moves an approved date.
7. **Financial Intelligence (AG Studio).** Embedded analytics over the same records: revenue, payment risk and scope-change impact, always per currency. AG Studio's built-in agents run on Claude through our server, and "Ask your finances" answers from figures computed by code and lists the figures it used.

### How we built it

- **Stack:** a Next.js 16 monolith (App Router, Server Actions) with strict TypeScript, Prisma, PostgreSQL and Better Auth.
- **Business rules:** small pure modules (state machines, payment eligibility, financial derivation) that AI output can never bypass.
- **AI:** Anthropic Claude through a provider interface with structured outputs and Zod validation. Versioned prompts; client text is wrapped as untrusted. A clearly labelled heuristic fallback exists for offline development.
- **PayPal:** Orders v2 through the APIMatic-generated PayPal Server SDK (`@paypal/paypal-server-sdk`), following APIMatic's Context Plugin skills (explicit timeouts, idempotent retries with `PayPal-Request-Id`). The browser uses the PayPal JS SDK; webhook signatures are checked with PayPal's REST verify API.
- **Integrity in the database:** unique capture IDs and webhook event IDs, one active payment request per milestone, row-level locks, and a capture lock that rules out double payment across two PayPal windows.
- **Hosting:** one AWS Lightsail instance (Docker Compose, Caddy with automatic HTTPS, PostgreSQL) at https://freelanceflow.hayaix.tech.

### PayPal integration

- **Orders v2:** create, capture and get, server-side, with idempotency keys, through `@paypal/paypal-server-sdk`.
- **PayPal JS SDK:** Smart Payment Buttons in the client portal.
- **Webhooks:** `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` / `PENDING` / `DENIED` / `DECLINED` / `REFUNDED` / `REVERSED`, each signature-verified.
- **Sandbox only:** no real money moves.

### AI integration

Claude (`claude-sonnet-5-5`) is used for:
- project extraction
- proposal drafting
- scope comparison with cited references
- schedule-risk explanations
- grounded financial answers
- AG Studio's agents, through a custom `AgLlmAdapter` bridge

Prices, permissions and payment state are always decided by deterministic code.

### Sponsor tools

- **Bryntum Gantt:** Smart Milestone Timeline (trial).
- **AG Studio (AG Grid):** Financial Intelligence dashboards, theming, and Studio Agent Framework on Claude (trial).
- **APIMatic:** PayPal Server SDK guided by the Context Plugin for PayPal.

Details and evidence: https://github.com/thosuperman/freelance-flow-ai/tree/main/docs/sponsors

### Challenges we ran into

- **Explainable AI rather than an oracle:** the approved scope is tagged with reference IDs, the model must cite them, and any reference that doesn't exist is dropped.
- **Exactly-once payments in an at-least-once world:** refreshes, double clicks, timeouts after PayPal already captured, and duplicate webhooks all converge on one idempotent path.
- **Keeping humans in control without friction:** assumption review, explicit consent and immutable versions, while the happy path still takes about three minutes.
- **Big sponsor bundles on a small server:** building on the admin machine and shipping a slim Linux image.

### Accomplishments that we're proud of

- The whole story runs on a public deployment with live Claude: conversation → approved proposal → PayPal deposit → AI-detected scope change → approved change request → updated totals, timeline and analytics.
- A real PayPal Sandbox capture was verified against PayPal's API, with signature-verified webhooks processed exactly once.
- 101 unit and integration tests and 5 Playwright end-to-end tests (desktop and mobile).

### What we learned

The most valuable thing AI does here is structure and explanation, not decisions. Once prices, permissions and payment state are owned by deterministic code, the AI can be ambitious without being dangerous.

### What's next for FreelanceFlow AI

- agency teams
- one-time-code confirmation for client approvals
- PayPal Subscriptions for SaaS plans
- automatic payment reminders driven by the timeline's risk flags
- a custom AG Studio payment-risk widget

---

## Built with (tags)

nextjs, typescript, react, tailwindcss, shadcn-ui, prisma, postgresql, better-auth, anthropic, claude, paypal, paypal-orders-api, paypal-server-sdk, paypal-webhooks, paypal-js-sdk, apimatic, bryntum, ag-grid, ag-studio, aws-lightsail, docker, caddy, vitest, playwright

## Testing instructions for judges

1. Open https://freelanceflow.hayaix.tech/demo → **Try the full demo**. No account is needed; you get a private workspace with an approved proposal, a $450 deposit ready to pay and a pending change request.
2. Follow the **Judge walkthrough** card: open the client portal → **Pay with PayPal** → log in with the PayPal **Sandbox** buyer below → approve. You'll see a receipt with the PayPal capture ID and $450 received on the project.
3. Approve change request #1 in the portal, then run **Scope & changes → Check against scope** (live Claude).
4. See the **Smart timeline** tab (Bryntum) and **Financial Intelligence** (AG Studio).

The PayPal **Sandbox** buyer login (simulated funds only) is shown on the demo page, the walkthrough card and the payment page, so no credentials need to be copied from here. Backup buyer, in case the shared one was changed: **[YOU: add from submission/JUDGE_CREDENTIALS.md, ideally in a judges-only field]**.

Full guide: https://github.com/thosuperman/freelance-flow-ai/blob/main/submission/JUDGE_DEMO_GUIDE.md

## How it was built during the hackathon

FreelanceFlow AI was created from scratch during the Submission Period. The first commit is dated 2026-11-07.

## Prize categories to select

- Grand Prize (automatic)
- Best Use of PayPal + AI
- Most Impactful
- Best Demo Delivery
- Best Use of Bryntum
- Best Use of AG Grid
- Best Use of APIMatic

A project can win at most one Grand or Honorable Mention prize plus one Sponsor prize.

## Screenshot list

| File | Shows |
| --- | --- |
| 01-landing | Landing page |
| 02-ai-project-creation | Client conversation ready for AI |
| 03-ai-review | AI review: assumptions, milestones, reconciliation |
| 04-proposal-sent | Proposal sent, immutable version |
| 05-client-approval | Client portal approval with consent |
| 06-paypal-sandbox-checkout | PayPal Sandbox buttons on the payment page |
| 07-scope-check | AI scope check with cited references and change request |
| 08-client-change-approval | Client approves the change |
| 09-project-financials | Updated totals |
| 10-smart-timeline | Bryntum Gantt with baseline and CR #1 |
| 11-financial-intelligence | AG Studio dashboard and grounded answer |
| 12-dashboard | Dashboard |
| 13-mobile-portal | Client portal on a phone |

Regenerate with `node scripts/capture-screenshots.mjs`.
