# AI design

## Principle: AI first, human controlled

AI analyses, drafts, classifies and explains. Deterministic code (not the model) controls money, authorization, payment eligibility, payment status, approval transitions and reconciliation. AI output is never stored as agreed terms until a human confirms it, and the client approves the resulting immutable version.

## Provider

- `src/lib/ai/provider.ts` defines the `AIProvider` interface: `generate<T>(task: { schema: ZodType<T>, system, user, ... })`.
- **Claude provider:** `@anthropic-ai/sdk`, `client.beta.messages.parse()` with `betaZodOutputFormat(schema)` (structured outputs), model `claude-opus-5-5` (configurable via `AI_MODEL`), adaptive thinking, `effort: "medium"`, server-side refusal fallback (`fallbacks: "default"`), 90 s timeout, 2 retries. The response is re-validated with `schema.safeParse` (defence in depth). `stop_reason` is checked for `refusal` and `max_tokens`. SDK errors map to friendly `AI_UNAVAILABLE` / `AI_INVALID_OUTPUT` errors.
- **Simulated provider:** transparent keyword and pattern heuristics (`src/lib/ai/simulated.ts`) for offline use and tests. Labelled **Simulated AI** in the UI and stored with `provider = "simulated"`.

The client uses an explicit `baseURL`, so the server never inherits an unrelated `ANTHROPIC_BASE_URL` from the shell.

## Tasks, schemas and prompts

| Task | Schema | Prompt version | Deterministic post-processing |
| --- | --- | --- | --- |
| Project extraction | `ProjectExtractionSchema` | `extract-project@2026-11-07.2` | `normalizeExtraction`: currency validated, budget parsed strictly, milestone amounts **recomputed** from percentages with decimal arithmetic (residue to the last milestone), warnings when splits don't reconcile |
| Proposal drafting | `ProposalDraftSchema` | `draft-proposal@2026-11-07.1` | Prices are never taken from the text; the pricing table renders from milestones |
| Scope comparison | `ScopeComparisonSchema` | `compare-scope@2026-11-07.2` | `normalizeComparison`: hallucinated scope refs are dropped (and listed), the **price is computed as hours × the freelancer's hourly rate**, otherwise no price |
| Change request drafting | part of `ScopeComparisonSchema.draftChangeRequest` | same | Title, description and deliverables are suggestions only; the freelancer edits them and sets the price |

Every run is persisted as an `AIAnalysis` row (provider, model, prompt version, input, output or error, latency) for traceability.

## Explainability for scope detection

The approved scope is sent to the model as reference-tagged items:

```
D1 [deliverable] Landing page design: …
E4 [exclusion]   Booking systems, e-commerce, payments or user account functionality
C1 [criterion]   …
A1 [added]       (deliverables from approved change requests)
```

The model has to cite these ids for every requested item. The UI shows the classification, confidence, reasoning, each requested item with its cited refs, and the full approved-scope list with cited items highlighted. Refs that don't exist are removed and shown as "ignored references".

## Prompt-injection awareness

- Client text is wrapped in `<untrusted_client_text>` tags; attempts to close the tag are neutralised.
- System prompts tell the model to treat that text as data, never to follow instructions inside it, and to report attempts (`suspiciousInstructions`). The UI shows a red "embedded instructions ignored" notice.
- The model has **no tools**. It can only emit schema-constrained JSON, so an injected instruction cannot trigger an action.
- Every number is re-derived or validated by server code. Prices never come from the model.

## Failure handling

Timeouts, rate limits, auth errors, refusals, truncation and schema mismatches all surface as user-friendly errors with a **Retry** button. Failures are stored (`succeeded = false`). AI calls are rate-limited (20 per 10 minutes per user) and demo workspaces are capped at 25 analyses.

## Verification status

**Verified live on 2026-11-07** with `AI_MODEL=claude-sonnet-5-5` (the code default is `claude-opus-5-5`). All three tasks ran against the real API, passed schema validation, and were stored with `provider = "anthropic"`:

- **Project extraction:** the demo landing-page message produced the $1,500 USD budget, the 30% / 70% milestone split, deliverables, exclusions, and five assumptions for review.
- **Proposal drafting:** client-ready wording; the prices still come from the milestones.
- **Scope comparison:** "add a booking system" was classified *outside approved scope* with high confidence, citing D1, D2 and E8, with clarifying questions and a client reply draft. The suggested price came from 6 estimated hours × the freelancer's rate, never from the model.

The prompt-injection example has not been run against the live model yet. The simulated provider and the unit tests cover it.
