# Bryntum: Smart Milestone Timeline

## What the sponsor asks for

From the [Bryntum sponsor page](https://paypalaihackathon.devpost.com/details/bryntum) (read 2026-11-08):

- **Best Use of Bryntum** is a judged prize for the project that "puts Gantt, Scheduler, and/or Calendar to the best use".
- One of their example ideas is an "Agency delivery board (Gantt)" with "payment tranches marked as dependencies, so a late PayPal payment visibly blocks the next phase". FreelanceFlow's timeline does this with real data.
- Setup is a 45-day trial from public npm (`npm install @bryntum/…@npm:@bryntum/…-trial`).

## The feature

**Project → Smart timeline** tab ([timeline-panel.tsx](../../src/components/timeline/timeline-panel.tsx)). It renders a Bryntum **Gantt** (`@bryntum/gantt-react` 7.3.8) built from the project's persisted records:

| Shown | Source |
| --- | --- |
| Work phases with start and end dates, deliverables and progress | Approved milestones (`dueDate`, `workStatus`) and their scope items |
| Payment markers (Gantt milestones) | Milestone amounts and PayPal payment requests (paid date or due date, status) |
| Dependencies | Deposit → first phase, phase → next phase, phase → its payment |
| **Baseline** (agreed plan) | The immutable approved proposal snapshot's due dates (Gantt Baselines feature) |
| Approved scope changes | Change-order milestones of approved change requests, in their own "Approved changes" group, labelled `CR #n` |
| Status colours | Done or paid green, planned blue, approved change violet, at risk orange, late or overdue red |
| Details panel | Click any bar: dates, agreed end and slippage, amount, work and payment status, deliverables, links |
| Zoom | Zoom in, zoom out and fit project |

**Intelligent behaviour** (deterministic, in [features/timeline/build.ts](../../src/features/timeline/build.ts)):

- A phase past its due date and not accepted is **late**. An open payment request past its due date is **overdue**.
- Everything downstream of a late or overdue item through dependencies is flagged **at risk**. For example, an overdue deposit flags the first work phase.
- **Slippage** compares current dates with the agreed baseline.
- Approved change requests appear as new phases. The summary shows how many days a change extends the schedule beyond the original agreement, and the original agreement and baseline stay unchanged.
- **Explain schedule risk** sends the computed facts (not client text) to Claude, which returns a headline, explanation, up to four recommendations and, when a client must act, a polite message. The prompt forbids changing approved dates or amounts and points to change requests instead. Each run is stored as an `AIAnalysis` (`TIMELINE_INSIGHT`).

**Read-only on purpose:** dragging a bar would silently change client-approved commitments. Schedule changes go through change requests that the client approves; their due date becomes the new phase's date.

## Implementation notes

- Loaded with `next/dynamic` and `ssr: false` only on the timeline tab, so other pages don't download Bryntum.
- CSS: structural `gantt.css`, the `stockholm-light` theme and the bundled FontAwesome, as the package's agent notes require.
- Props passed to `BryntumGantt` are kept referentially stable. The wrapper re-applies any changed prop, and re-applying `subGridConfigs` on every render crashed with "Id … already in use" during testing.
- Tooltips encode values with `StringHelper.encodeHtml`.

## Testing

| Test | Covers |
| --- | --- |
| [tests/unit/timeline.test.ts](../../tests/unit/timeline.test.ts) (8) | Milestone-to-phase mapping, dates, dependencies, baseline and slippage, approved vs unapproved change orders, late propagation, overdue payments, missing dates, JPY amounts |
| [tests/integration/timeline.test.ts](../../tests/integration/timeline.test.ts) (3) | Built from real DB records, change request approval adds a phase without moving the baseline, owner-only access, AI explanation stored without changing any milestone |
| [e2e/demo-story.spec.ts](../../e2e/demo-story.spec.ts) | The production build renders the Gantt with "Original agreement" and "CR #1" |
| Manual (2026-11-08) | Rendered locally; bar selection and details panel; **Explain schedule risk with live Claude** returned a grounded answer |

## Licensing

- Bryntum Gantt is **commercial software**. This build uses the **trial** package (`"@bryntum/gantt": "npm:@bryntum/gantt-trial@7.3.8"`), installed from public npm as Bryntum's own instructions show. The trial shows a watermark and runs for 45 days.
- **No Bryntum code is committed** to this repository: only the `package.json` dependency entry. Anyone reproducing the build gets the trial from npm.
- The trial's install step (`@bryntum/gantt-trial-lib` postinstall, approved in `package.json` `allowScripts`) writes the trial licence string into the installed package; nothing is bypassed.
- For use after the trial, buy a licence and switch the alias to the licensed package as Bryntum documents.
