# Sponsor integrations

Status as of 2026-11-08. Every item links to code and to the verification that was actually done.

| Sponsor | Prize | What FreelanceFlow does with it | Status | Details |
| --- | --- | --- | --- | --- |
| **Bryntum** | Best Use of Bryntum | **Smart Milestone Timeline**: a Bryntum Gantt per project, built from approved milestones, PayPal payment requests and approved change requests. Shows a baseline of the agreed plan, payment dependencies, late/overdue/at-risk propagation, a details panel, zoom, and a Claude schedule explanation that never changes commitments | ✅ Built, tested (unit, integration, E2E), verified in browser with live Claude | [docs/sponsors/BRYNTUM.md](../docs/sponsors/BRYNTUM.md) |
| **AG Grid** | Best Use of AG Grid | **Financial Intelligence** in AG Studio: 6 related tables from real records, 3 report pages, app theme, customize mode and saved layouts, built-in sorting, filtering and export. Studio's built-in agents run on Claude through our `AgLlmAdapter` bridge, plus grounded "Ask your finances" | ✅ Built, tested, verified (agent run with 7 Claude turns). Not done: custom widget, custom agent | [docs/sponsors/AG_GRID.md](../docs/sponsors/AG_GRID.md) |
| **APIMatic** | No judged prize (subscription for participants who used the plugin) | PayPal Orders through the APIMatic-generated PayPal Server SDK, following the APIMatic Context Plugin skills: explicit timeout, idempotent POST retries, overall deadline, and error mapping for the non-exported error class | ✅ Built, unit-tested, live Sandbox create/replay/get verified. The plugin installer was blocked in the agent sandbox, so the skills were read directly from PayPal's repository | [docs/sponsors/APIMATIC.md](../docs/sponsors/APIMATIC.md) |

## Why these matter to freelancers

- **Timeline:** freelancers see at a glance whether the work, the agreed dates and the money line up, and a late PayPal payment visibly blocks the next phase.
- **Financial Intelligence:** answers "who owes me what, and how much did scope changes earn me?" without spreadsheets, and never mixes currencies.
- **APIMatic and the PayPal Server SDK:** the payment integration rests on PayPal's official generated SDK with explicit resilience settings, not hand-rolled HTTP.

## Licences

Bryntum Gantt and AG Studio are commercial and run as **trials** (watermarks; 45 days), installed from public npm. No proprietary code is committed to the repository.
