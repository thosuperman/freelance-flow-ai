# Technologies used

**PayPal**
- PayPal Orders v2 REST API: create order, capture order, get order (server-side, with `PayPal-Request-Id` idempotency)
- PayPal Webhooks: `verify-webhook-signature`; events CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED / PENDING / DENIED / DECLINED / REFUNDED / REVERSED
- PayPal JavaScript SDK via `@paypal/react-paypal-js` (Smart Payment Buttons)
- PayPal Sandbox

**AI**
- Anthropic Claude (`claude-opus-5-5`) through the official `@anthropic-ai/sdk`, with structured outputs (`messages.parse` + Zod), adaptive thinking and server-side refusal fallback
- Zod schemas for every AI task, versioned prompts, deterministic post-processing

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
- Vercel (hosting, cron), managed PostgreSQL, Docker Compose for local development
