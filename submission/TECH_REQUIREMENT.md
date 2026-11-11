## How FreelanceFlow AI meets the technology requirement

FreelanceFlow AI is built around both pieces: **PayPal handles every payment**, and **Claude handles every step that requires understanding language**. All payments run in the free **PayPal Sandbox**.

### PayPal tools

1. **PayPal Orders API v2**, called through the official **PayPal Server SDK** (`@paypal/paypal-server-sdk`). When a client pays a milestone, our server creates the PayPal order using the amount from the approved agreement; amounts sent by the browser are never trusted. After the buyer approves, the server captures the payment and checks the amount, currency and our payment reference. Only then is the milestone marked as paid. Each request carries a `PayPal-Request-Id`, so retries and double clicks never charge twice.
2. **PayPal JavaScript SDK** (Smart Payment Buttons, via `@paypal/react-paypal-js`). This shows the "Pay with PayPal" and card buttons in the client's private portal, where the client approves the payment in PayPal's own window.
3. **PayPal Webhooks** and the **Verify Webhook Signature API**. We subscribe to the order-approved event and to capture completed, pending, denied, declined, refunded and reversed. Every event's signature is verified with PayPal before we act on it. Webhooks finish payments that were still pending, recover payments where the client closed the tab, record refunds, and are processed only once.
4. **PayPal Sandbox.** The app's Business (merchant) Sandbox account receives the payments, and a Sandbox Personal (buyer) account is provided so judges can pay. For example, capture `0NR741936P3696537` (USD 450.00) was verified on the live site, and its signed webhook was processed.

### AI tools

1. **Anthropic Claude** (`claude-sonnet-5-5`), through the official Anthropic SDK with structured outputs, so every answer is checked against a schema before the app uses it. It:
   - **Turns a client message into a draft project:** deliverables, exclusions, budget, timeline, milestones and the assumptions it made, which the freelancer reviews before anything is agreed.
   - **Drafts the proposal wording.** Prices come only from the milestones, never from the AI.
   - **Checks new client requests against the approved scope:** it classifies them as in or out of scope, cites the exact deliverables and exclusions it used, and suggests clarifying questions and a reply. The price for extra work is calculated by code from the freelancer's hourly rate.
   - **Explains schedule risk** on the Smart timeline, for example late work or overdue payments, and drafts a polite message to the client. It never changes approved dates.
   - **Answers financial questions** using figures our code has already calculated, and shows which figures it used.
2. **AG Studio Agent Framework**, running on Claude. The built-in analytics agents in our Financial Intelligence dashboard run on Claude through our own server, so freelancers can explore revenue, payment risk and scope-change income.
3. **APIMatic Context Plugin for PayPal** (used while building). This AI-coding tool provided the PayPal Server SDK guidance we followed, including explicit timeouts, safe retries and error handling.

### How they work together

AI understands the work and explains its reasoning. The freelancer and the client approve every commitment. PayPal moves the money, and FreelanceFlow records a payment only after PayPal confirms it.
