import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, RotateCcw } from "lucide-react";
import type { ProjectDetail } from "@/features/projects/service";

/**
 * Step-by-step guide shown on the pre-filled judge project. Each step's tick comes from persisted
 * records (a verified PayPal capture, an approved change request, a stored AI scope analysis),
 * never from clicks.
 */
export function JudgeWalkthrough({ project, portal }: { project: ProjectDetail; portal: string | null }) {
  const base = `/app/projects/${project.id}`;
  const deposit = project.milestones.find((m) => m.kind === "DEPOSIT");
  const paid = deposit?.paymentStatus === "PAID";
  const crApproved = project.changeRequests.some((c) => c.status === "APPROVED");
  const scopeChecked = project.changeRequests.some((c) => c.analysisId) || false;
  const steps: { done: boolean; title: string; body: string; href?: string; external?: boolean; cta?: string }[] = [
    {
      done: true,
      title: "Approved agreement",
      body: "The proposal was sent as an immutable, hashed version and approved by the demo client. See the Proposal and Activity tabs.",
      href: `${base}?tab=proposal`,
      cta: "View proposal",
    },
    {
      done: paid,
      title: "Pay the $450 deposit with PayPal Sandbox",
      body: "Open the client portal → Pay with PayPal → log in with the Sandbox buyer account from the testing instructions. The deposit is marked paid only after the server captures and verifies it with PayPal.",
      href: portal ?? undefined,
      external: true,
      cta: "Open client portal",
    },
    {
      done: crApproved,
      title: "Approve the pending change request as the client",
      body: "In the same portal, approve change request #1 (booking system, priced from the freelancer's hourly rate). Totals update from approved records.",
      href: portal ?? undefined,
      external: true,
      cta: "Open client portal",
    },
    {
      done: scopeChecked,
      title: "Run an AI scope check",
      body: "Scope & changes → Insert example request (or type your own) → Check against scope. Live Claude cites the exact deliverables and exclusions it used.",
      href: `${base}?tab=scope`,
      cta: "Scope & changes",
    },
    {
      done: false,
      title: "See it on the Smart timeline and in Financial Intelligence",
      body: "Bryntum Gantt with the agreed baseline and payments, and AG Studio analytics over the same records.",
      href: `${base}?tab=timeline`,
      cta: "Smart timeline",
    },
  ];
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4" data-testid="judge-walkthrough" aria-labelledby="judge-walkthrough-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Judge walkthrough · pre-filled demo</p>
          <h2 id="judge-walkthrough-title" className="font-semibold">
            Your private copy of the demo project
          </h2>
          <p className="text-sm text-muted-foreground">Only you can see this workspace. PayPal runs in Sandbox: no real money moves.</p>
        </div>
        <Link href="/demo" className="inline-flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-muted">
          <RotateCcw className="size-3.5" /> Start over
        </Link>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border bg-white p-3 text-sm">
            {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-label="done" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="to do" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {i + 1}. {s.title}
              </p>
              <p className="text-muted-foreground">{s.body}</p>
            </div>
            {s.href ? (
              s.external ? (
                <a href={s.href} target="_blank" rel="noopener" className="inline-flex h-fit shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                  {s.cta} <ExternalLink className="size-3" />
                </a>
              ) : (
                <Link href={s.href} className="inline-flex h-fit shrink-0 items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  {s.cta}
                </Link>
              )
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
