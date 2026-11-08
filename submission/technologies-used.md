# Technologies used

**PayPal**
- PayPal Orders v2 REST API: create order, capture order, get order (server-side, with `PayPal-Request-Id` idempotency)
- PayPal Webhooks: `verify-webhook-signature`; events CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED / PENDING / DENIED / DECLINED / REFUNDED / REVERSED
- PayPal JavaScript SDK via `@paypal/react-paypal-js` (Smart Payment Buttons)
- PayPal Server SDK `@paypal/paypal-server-sdk` (APIMatic-generated) for Orders, built with the APIMatic Context Plugin for PayPal
- PayPal Sandbox

**AI**
- Anthropic Claude (deployed with `claude-sonnet-5-5`; code default `claude-opus-5-5`) through the official `@anthropic-ai/sdk`, with structured outputs (`messages.parse` + Zod), adaptive thinking and server-side refusal fallback
- Zod schemas for every AI task, versioned prompts, deterministic post-processing

**Sponsor tools**
- Bryntum Gantt (`@bryntum/gantt-react`, trial): Smart Milestone Timeline with baselines, dependencies and status
- AG Studio (`ag-studio-react`, trial): Financial Intelligence dashboards, theming, Studio Agent Framework with a Claude adapter
- APIMatic Context Plugin for PayPal (skills for the PayPal Server SDK)

**Application**
- Next.js 16 (App Router, Server Components, Server Actions, Turbopack), React 19, TypeScript (strict)
- Tailwind CSS 4, shadcn/ui (Radix primitives), lucide-react, Sonner
- React Hook Form, Zod 4
- Better Auth (email/password, database sessions)
- Prisma 6 + PostgreSQL 16
- decimal.js (exact money arithmetic)

**Quality**
- Vitest, React Testing Library, Playwright
- ESLint, TypeScript strict

**Infrastructure**
- AWS Lightsail (one Ubuntu 24.04 instance, us-east-1), Docker Compose, Caddy (automatic Let's Encrypt TLS), PostgreSQL 16, Route 53 DNS
