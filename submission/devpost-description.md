# FreelanceFlow AI

## Inspiration

Freelancers rarely lose money because they are bad at their craft. They lose it in the gaps: the budget agreed in a WhatsApp thread, the "quick extra" nobody priced, the final invoice sent three weeks late, the argument about what was *actually* agreed. Existing tools ask freelancers to re-type all of that into projects, invoices and payment schedules by hand.

We wanted the agreement itself to become the system of record, with AI doing the administrative work and humans and PayPal staying firmly in charge of commitments and money.

## What it does

1. **Conversation → project.** Paste a client message, email or brief. Claude extracts deliverables, exclusions, budget, currency, timeline, milestones and acceptance criteria into a schema-validated draft. Every assumption the AI made is flagged and has to be accepted or rejected before the project can be confirmed. Milestone amounts are recomputed with exact decimal arithmetic and must reconcile with the project value.
2. **Proposal → immutable agreement.** AI drafts professional proposal language (never prices). Sending freezes the terms into a versioned snapshot with a SHA-256 hash. The client opens a private portal link and approves *that exact version*; we record who, when, which hash and which amount.
3. **Milestones → PayPal payments.** Deposits become payable on approval, and delivery milestones after the client accepts the work. The server creates a PayPal order from the stored amount, captures it after buyer approval, verifies amount, currency and reference, and records the capture exactly once. Verified webhooks and provider reconciliation cover pending captures, closed tabs, timeouts, refunds and duplicate deliveries.
4. **Scope protection, our signature feature.** When the client writes "Can you also add a booking system?", FreelanceFlow compares the request with the approved scope and explains its decision by citing the exact deliverables and exclusions it used. Out-of-scope work becomes a change request priced from the freelancer's own hourly rate (AI estimates hours but never sets a price). The client approves it and the scope, milestones and totals update. The original agreement is never overwritten.
5. **Financial truth.** Original contract, approved changes, revised value, paid, outstanding, pending and overdue. All derived from approved records and verified PayPal captures, never from editable totals, and never mixing currencies.

## How we built it

A modular Next.js 16 monolith with strict TypeScript, Prisma and PostgreSQL. Business rules live in small pure modules (milestone and change-request state machines, payment eligibility, financial derivation) that AI output can never bypass. AI goes through a provider interface: Claude with structured outputs in production, and a clearly labelled heuristic fallback for offline use. PayPal goes through a gateway interface: the real Orders v2 REST client for Sandbox/Live, and an in-process simulator that exercises the same code paths in tests.

Integrity is enforced in the database: unique capture ids, unique webhook event ids, a partial-uniqueness key for one active payment request per milestone, row-level locks and a capture lock that makes double payment across two PayPal windows impossible.

## Challenges we ran into

- **Making AI explainable rather than oracular.** We tag the approved scope with reference ids and require the model to cite them, then drop any reference that doesn't exist.
- **Exactly-once payments in an at-least-once world.** Browser refreshes, double clicks, timeouts after PayPal already captured, and duplicate webhooks all converge on one idempotent `recordCapture` path.
- **Keeping humans in control without adding friction.** Assumption review, explicit consent checkboxes and immutable versions, while the happy path still takes about three minutes.

## Accomplishments that we're proud of

- The complete story (conversation → approved proposal → PayPal deposit → AI-detected scope change → approved change request → updated totals) is a real, repeatable workflow, covered end to end by Playwright on a production build.
- 72 unit and integration tests across money arithmetic, state machines, authorization boundaries, approval tamper detection, concurrent captures, amount mismatches, pending captures, refunds and webhook verification.
- Honest labelling: anything simulated says so on screen.

## What we learned

The most valuable thing AI does here is structure and explanation, not decisions. Once prices, permissions and payment state are owned by deterministic code, the AI can be ambitious without being dangerous.

## What's next for FreelanceFlow AI

Agency teams and organizations, email one-time-code confirmation for client approvals, PayPal Subscriptions for SaaS plans, multi-language proposals, and automatic payment reminders.

## Built with

Next.js · TypeScript · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL · Better Auth · Anthropic Claude · PayPal Orders API · PayPal Webhooks · PayPal JS SDK · Vitest · Playwright

> Status note for judges: live PayPal Sandbox and live Claude runs depend on credentials configured in the deployment. See `submission/release-checklist.md` for what has been verified and how.
