import type { Metadata } from "next";
import Link from "next/link";
import { aiConfig } from "@/lib/ai/provider";
import { paypalConfig } from "@/lib/paypal";
import { Logo } from "@/components/shared/logo";
import { StartDemoButton } from "@/components/demo/start-demo-button";
import { SandboxBuyerCard } from "@/components/demo/sandbox-buyer-card";
import { sandboxBuyer } from "@/features/demo/sandbox-buyer";

export const metadata: Metadata = { title: "Experience FreelanceFlow AI" };
// Reads runtime configuration (AI provider, PayPal mode, optional Sandbox buyer), so render per request.
export const dynamic = "force-dynamic";

const FLOW = [
  "Load an example client conversation",
  "Run AI project extraction",
  "Review the generated scope and milestones",
  "Preview and send the proposal",
  "Open the client portal and approve it",
  "Pay the deposit through PayPal",
  "Introduce a scope change",
  "Generate a change request with AI",
  "Approve the change as the client",
  "Review the updated financial totals",
  "See the change on the Smart timeline (Bryntum Gantt)",
  "Explore Financial Intelligence (AG Studio + Claude)",
];

export default function DemoPage() {
  const ai = aiConfig();
  const pp = paypalConfig();
  const buyer = sandboxBuyer();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Experience FreelanceFlow AI</h1>
          <p className="mt-3 text-muted-foreground">
            Get your own private, time-limited demo workspace and walk the full story in about three minutes — you play both the freelancer and the client.
          </p>
          <div className="mt-6 space-y-3 rounded-2xl border bg-card p-5 text-sm shadow-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">AI</span>
              <span className="font-medium">{ai.provider === "anthropic" ? `Claude · ${ai.model}` : "Simulated heuristics (no API key configured)"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Payments</span>
              <span className="font-medium">
                {pp.mode === "mock" ? "Simulated PayPal (test mode)" : pp.mode === "sandbox" ? "PayPal Sandbox — sandbox buyer account required" : "PayPal Live"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Workspace</span>
              <span className="font-medium">Isolated, expires after 24 hours</span>
            </div>
          </div>
          {buyer ? <div className="mt-3"><SandboxBuyerCard buyer={buyer} /></div> : null}
          {pp.mode === "sandbox" && !buyer ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Step 6 requires a PayPal Sandbox personal (buyer) account. Payment is only marked as received after PayPal confirms the capture.
            </p>
          ) : null}
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
              <p className="text-sm font-semibold">Short on time? Start pre-filled</p>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">
                Opens a private project that already has an approved proposal, a $450 deposit ready to pay with PayPal Sandbox, and a pending change request. Takes about two minutes.
              </p>
              <StartDemoButton full />
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Or walk the whole story from a client message, starting with AI extraction:</p>
              <StartDemoButton variant="outline" />
            </div>
          </div>
        </div>
        <ol className="space-y-2">
          {FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-primary">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
