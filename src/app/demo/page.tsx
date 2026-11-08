import type { Metadata } from "next";
import Link from "next/link";
import { aiConfig } from "@/lib/ai/provider";
import { paypalConfig } from "@/lib/paypal";
import { Logo } from "@/components/shared/logo";
import { StartDemoButton } from "@/components/demo/start-demo-button";

export const metadata: Metadata = { title: "Experience FreelanceFlow AI" };

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
          {pp.mode === "sandbox" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Step 6 requires a PayPal Sandbox personal (buyer) account. Payment is only marked as received after PayPal confirms the capture.
            </p>
          ) : null}
          <div className="mt-6">
            <StartDemoButton />
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
