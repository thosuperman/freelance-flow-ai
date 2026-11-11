# Judge demo guide

**Live app:** https://freelanceflow.hayaix.tech. No account, password or setup is needed for the app itself. PayPal runs in **Sandbox**, so no real money moves.

## Fastest path (about 3 minutes)

1. Open **https://freelanceflow.hayaix.tech/demo** and click **Try the full demo**.
   - You get a private workspace (only you can see it; it expires after 24 hours).
   - It opens a project that already has an approved proposal, a **$450 deposit ready to pay**, and a **pending change request**.
2. Follow the yellow **Judge walkthrough** card at the top of the project. Each step ticks off from real records.
   - **Pay the deposit:** click **Open client portal**, then **Pay with PayPal**.
     - Log in with the **PayPal Sandbox buyer** shown on the page (email and password with copy buttons), and approve the payment.
     - Expected result: you return to a receipt showing a **PayPal capture ID** and "PayPal Sandbox". Back on the project, *Payments received* shows **$450.00**.
     - The server marks it paid only after PayPal confirms the capture.
   - **Approve the change request:** in the client portal, tick the consent box on change request #1 and approve it. The project total becomes **$1,800.00**.
   - **AI scope check:** open **Scope & changes**, click **Insert example request** (or type your own), then **Check against scope**.
     - Expected result: live Claude classifies the request and cites the exact deliverables and exclusions it used (D1, E1…).
     - The suggested price is hours × the freelancer's rate; the AI never sets prices.
   - **Smart timeline** tab (Bryntum Gantt) and **Financial Intelligence** in the sidebar (AG Studio) show the same records.

## Full story from a client message (about 5 minutes)

On `/demo`, click **Start my demo workspace** instead. Paste or keep the example client message and click **Analyse with AI**. Then follow the "Next step" card: review, confirm, AI proposal, send, approve in the portal, request the deposit, pay, scope check, change request.

## Roles

| Role | How |
| --- | --- |
| Freelancer | The demo workspace you are signed into |
| Client | The **Client portal** link on the project (opens in a new tab; no login) |
| PayPal buyer | The Sandbox buyer login shown on `/demo`, on the walkthrough card and on the payment page |

## Restarting

Click **Start over** on the walkthrough card, or go to `/demo` again. Every start creates a fresh, separate workspace. Up to 8 new workspaces per network per hour.

## Several judges at once

Each workspace is isolated:
- its own projects, payment requests and PayPal orders
- captures are recorded once per order (unique capture IDs, row locks)
- judges can't see each other's data.

Several judges can use the **same** Sandbox buyer account at the same time. Each payment is a separate PayPal order. More than one buyer account is still provided as a fallback.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The PayPal popup is blocked | Allow pop-ups for freelanceflow.hayaix.tech, then click **Pay with PayPal** again |
| PayPal asks for a password you don't have | Use the Sandbox buyer shown on the payment page, not a real PayPal login. If it was changed by someone, use the backup buyer from the testing instructions |
| You closed the popup after approving | Reload the receipt or project page: the app checks the order with PayPal and records the capture if it went through |
| Timeline or analytics shows "Loading…" | The first visit downloads about 2 MB; wait a few seconds |
| "Too many demo workspaces" | The per-network hourly limit was reached; wait or use an existing workspace |
| AI answers look generic | Check the badge: production runs live Claude, and a "Simulated" badge would mean the AI key is missing |

## What is real

- **AI:** live Anthropic Claude.
- **Payments:** PayPal Sandbox Orders v2 via the PayPal Server SDK; captures verified server-side, with signature-verified webhooks.
- **Sponsor tools:** Bryntum Gantt and AG Studio run as vendor trials (watermark).
- **Seeded data:** the pre-filled project's client approval is a demo approval ("Jordan Lee (demo client)"). Every other step is performed by you.
