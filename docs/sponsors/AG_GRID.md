# AG Grid: Financial Intelligence with AG Studio

## What the sponsor asks for

From the [AG Grid sponsor page](https://paypalaihackathon.devpost.com/details/aggrid) (read 2026-11-08):

- **Best Use of AG Grid** covers "both what your dashboard looks like and how you build it".
- It asks for **AG Studio** polish ("custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own") and to try the **Studio Agent Framework**: "a custom agent talking to Studio's built-in agents, or a swapped-in harness".
- It offers a free 45-day trial and a [PayPal + AG Studio boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate), which we read for the data-source, report and AI-adapter patterns.

## The feature

**Financial Intelligence** (`/app/insights`, in the main navigation) embeds **AG Studio** (`ag-studio` and `ag-studio-react` 3.1.0) over the freelancer's real records:

| Data source (Studio table) | From |
| --- | --- |
| `clients`, `projects` | Owner-scoped projects. Original value, approved changes, revised value, verified paid, outstanding and overdue come from the same decimal calculations (`financialsFor`) as the project pages |
| `milestones` | Agreed and change-order milestones with work and payment status |
| `paymentRequests` | PayPal payment requests with overdue flag, days overdue and days to pay |
| `transactions` | Verified PayPal captures (capture ID, environment, verification source) |
| `changeRequests` | Scope changes with approved amount |

Tables are related many-to-one, plus a shared calendar on capture and due dates, so Studio can cross-filter and drill across them. One calculated measure is defined: collection rate.

**Report** ([studio-config.ts](../../src/components/insights/studio-config.ts)), three pages:

1. **Revenue overview:**
   - currency filter
   - totals-by-currency grid
   - collected-vs-contracted gauge
   - paid vs outstanding by project
   - verified PayPal payments by month, split by currency
   - projects grid
2. **Payment risk:** requests by status, requested amounts by client (overdue vs on time), and a grid sorted by days overdue.
3. **Scope change impact:** change requests by status, approved scope-change revenue by project, and all change requests.

**Interactivity:**
- Built-in sorting, filtering, cross-filtering and export from AG Studio.
- **Customize** switches Studio to edit mode, where you can add widgets, edit layouts and use the data and compose panels.
- **Save layout** persists the report in the browser, and **Reset** restores the default.

**Theming:** `studioTheme.withParams(...)` maps Studio's tokens to FreelanceFlow's CSS variables (font, card, border, primary, muted), so widgets match the rest of the app.

**Studio Agent Framework with a swapped-in Claude adapter:**
- **Built-in agents on Claude:** AG Studio's built-in agents (orchestrator → Data agent and others) run on **Claude** through a custom `AgLlmAdapter`.
  - Browser: [claude-adapter.ts](../../src/components/insights/claude-adapter.ts).
  - Server: [features/insights/studio-turn.ts](../../src/features/insights/studio-turn.ts) and the [`/api/insights/studio-turn`](../../src/app/api/insights/studio-turn/route.ts) route.
- **How the bridge works:** it maps Studio conversation items, tool schemas and JSON response formats to Claude Messages and tool use. JSON outputs become a forced tool call.
- **Server route safeguards:**
  - session authentication and a same-origin check
  - per-user, per-demo-workspace and site-wide daily turn limits
  - a request size cap
  - the key stays server-side
- **System guidance:** "never add amounts across currencies", "no cost data, no profit".
- **Prompt starters:** overdue payments, scope-change revenue, milestones awaiting payment, biggest balances.

**Ask your finances** (above the dashboard):
- A grounded Q&A. FreelanceFlow computes per-currency facts with decimal arithmetic, and Claude answers using only those facts.
- The UI lists the exact figures the answer cites. Each answer is stored as `AIAnalysis` (`FINANCIAL_INSIGHT`).

## Multi-currency safety

- Money fields use a decimal format plus an explicit currency field, never a currency-symbol format that would label EUR as `$`.
- Money is never summed across currencies:
  - Totals are a grid **grouped by currency**.
  - Monthly payments are **split by currency** in the legend.
  - Each page has a currency filter.
  - The Studio data description and the agent's system guidance both say so.
- "Ask your finances" facts are computed per currency. A test checks USD and EUR stay separate.
- No profit or margin is shown or claimed (there is no cost data).

## Verification

| Check | Result |
| --- | --- |
| [tests/integration/insights.test.ts](../../tests/integration/insights.test.ts) (4) | Revenue, scope-change and outstanding figures from approved records (1,500 + 300 = 1,800 USD); currencies kept separate; owner-only data; grounded Q&A stores a `FINANCIAL_INSIGHT` and rejects invalid questions |
| [tests/unit/studio-turn.test.ts](../../tests/unit/studio-turn.test.ts) (6) | Studio → Claude message and tool mapping, forced JSON, Claude → Studio output items, truncation, malformed input |
| [e2e/demo-story.spec.ts](../../e2e/demo-story.spec.ts) | The production build renders AG Studio with "Totals by currency" and USD |
| Manual (2026-11-08) | Studio rendered real data (paid $450 vs outstanding $1,050). In edit mode, the prompt starter "Overdue payments" was answered by Studio's orchestrator delegating to the built-in **Data agent on Claude**: 7 tool-using turns through `/api/insights/studio-turn`, all HTTP 200. The answer was grounded in the tables (filtered `isOverdue`, cross-checked `projects.overdue`, per currency) |

## Licensing

- AG Studio is **commercial** (`ag-studio`, `ag-studio-react`: "Commercial"). Without a licence key it runs as a **trial**: in AG Studio's words, all "AG Studio Pro with AI" features are unlocked, with a watermark and console notices.
- An optional `AG_STUDIO_LICENSE_KEY` environment variable is passed to `AgStudioProvider` if AG Grid issues a trial key (to hide the watermark).
- No AG Studio code is committed; it installs from public npm.

## Not done

- **No custom widget** was built. The sponsor highlights custom widgets, and this would be the next step, for example a "payment risk scoreboard" widget.
- **No custom agent** was added alongside the built-in ones. The integration is a swapped-in model adapter (harness defaults on Claude), not a new agent definition.
- Saved layouts are per browser (localStorage), not per account.
