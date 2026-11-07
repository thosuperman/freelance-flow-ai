import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleSlash,
  FileSignature,
  Handshake,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { getCurrentUser } from "@/features/auth/session";

const STEPS = [
  { icon: MessageSquareText, title: "Paste the conversation", body: "Emails, DMs, call notes — however messy. Client text is treated as untrusted data." },
  { icon: Sparkles, title: "AI drafts the deal", body: "Deliverables, exclusions, milestones and payment schedule — with every assumption flagged for you to confirm." },
  { icon: FileSignature, title: "Client approves a locked version", body: "A private portal link. Approval is tied to an immutable, hashed version of the terms." },
  { icon: Wallet, title: "Get paid per milestone", body: "PayPal checkout with server-side capture verification. Your dashboard updates from verified payments only." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link href="/app">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/demo">Try the demo</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.93_0.05_268)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center animate-fade-up">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
                <span className="size-1.5 rounded-full bg-primary" /> Built for the PayPal AI Hackathon 2026
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                From conversation to contract.
                <br />
                <span className="text-primary">From work to payment.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-balance">
                FreelanceFlow AI turns messy client messages into clear agreements, approved milestones and PayPal payments — and catches scope creep before
                you work for free.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 px-5 text-base">
                  <Link href={user ? "/app/new?example=landing" : "/demo"}>
                    <Sparkles /> Turn a client message into a project
                  </Link>
                </Button>
                {!user ? (
                  <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                    <Link href="/sign-up">Create free account</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <MessageSquareText className="size-4" /> Client message
                </div>
                <p className="text-[15px] leading-relaxed">
                  “I need a landing page for my business. Budget is <mark className="rounded bg-amber-100 px-0.5">$1,500</mark>. I need a first draft in{" "}
                  <mark className="rounded bg-amber-100 px-0.5">seven days</mark> and final delivery in <mark className="rounded bg-amber-100 px-0.5">fourteen days</mark>. I’ll pay{" "}
                  <mark className="rounded bg-amber-100 px-0.5">30% upfront</mark> and the rest when everything is finished.”
                </p>
              </div>
              <div className="flex justify-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-indigo-500/30">
                  <ArrowRight className="size-5 max-lg:rotate-90" />
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Business Landing Page</span>
                  <span className="text-sm font-semibold tabular">$1,500.00</span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                    <span>1 · Upfront deposit (30%)</span>
                    <span className="font-medium tabular">$450.00</span>
                  </li>
                  <li className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                    <span>2 · Final delivery & approval</span>
                    <span className="font-medium tabular">$1,050.00</span>
                  </li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">2 assumptions to confirm</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">4 exclusions suggested</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div key={s.title} className="rounded-2xl border bg-background p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-primary">
                      <s.icon className="size-4" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                <ShieldAlert className="size-3.5" /> The signature feature
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Scope protection that shows its work</h2>
              <p className="mt-3 text-muted-foreground">
                When a client asks for “just one more thing”, FreelanceFlow compares it with what they actually approved — citing the exact deliverables and
                exclusions it used. Out-of-scope work becomes a priced change request the client approves before you start.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Explainable: every decision cites approved scope items",
                  "Prices come from your own rate — AI never sets a price",
                  "The original agreement is preserved; approved changes are layered on top",
                  "Additional payments flow through the same verified PayPal checkout",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="rounded-xl bg-muted/60 p-3 text-sm">“Can you also add a booking system?”</div>
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200 ring-inset">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="size-4" /> Outside approved scope · high confidence
                </div>
                <p className="mt-1 text-red-900/80">Not covered by D1 “Landing page design” or D2 “Landing page build”, and matches exclusion E4.</p>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>
                  <span className="font-medium">Change request #1:</span> Add booking system
                </span>
                <span className="font-semibold tabular">$300.00</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CircleSlash className="size-3.5" /> 6 h estimate × your $50/h rate — you confirm the price.
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Sparkles, t: "AI understands the work", b: "Claude extracts structure and drafts language. Outputs are schema-validated and never treated as agreed." },
                { icon: Handshake, t: "Humans approve the agreement", b: "Only the client can approve proposals and change requests. Only verified captures count as paid." },
                { icon: Wallet, t: "PayPal handles the payment", b: "Orders API with server-side amounts, idempotent capture, webhook signature verification and reconciliation." },
              ].map((c) => (
                <div key={c.t} className="rounded-2xl border p-5">
                  <c.icon className="mb-3 size-5 text-primary" />
                  <h3 className="font-semibold">{c.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.b}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link href="/demo">
                  Experience FreelanceFlow AI <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 FreelanceFlow AI. Hackathon MVP — not legal or financial advice.</span>
          <span>AI understands the work. Humans approve the agreement. PayPal handles the payment.</span>
        </div>
      </footer>
    </div>
  );
}
