import Link from "next/link";
import { ArrowRight, BarChart3, CalendarRange, CircleCheckBig, Clock, ExternalLink, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { paymentEligibility } from "@/features/milestones/rules";
import type { ProjectDetail } from "@/features/projects/service";

type Step = { title: string; body: string; cta?: { label: string; href: string; external?: boolean }; tone: "action" | "waiting" | "done" };

function decide(p: ProjectDetail, portal: string | null): Step {
  const base = `/app/projects/${p.id}`;
  const latest = p.proposal?.versions[0];
  if (p.status === "DRAFT") {
    if (latest?.status === "REVISION_REQUESTED") {
      return {
        tone: "action",
        title: "Your client requested revisions",
        body: latest.clientNote ? `“${latest.clientNote}” — update the terms or proposal, then send a new version.` : "Update the terms or proposal, then send a new version.",
        cta: { label: "Revise proposal", href: `${base}?tab=proposal` },
      };
    }
    if (!p.proposal) {
      return { tone: "action", title: "Write the proposal", body: "Draft professional proposal text with AI, review it, then send it to your client for approval.", cta: { label: "Open proposal", href: `${base}?tab=proposal` } };
    }
    return { tone: "action", title: "Send the proposal", body: "Your terms are ready. Sending locks them into an immutable version that your client approves in their portal.", cta: { label: "Review & send", href: `${base}?tab=proposal` } };
  }
  if (p.status === "PROPOSED") {
    return { tone: "waiting", title: "Waiting for your client to approve", body: "Share the client portal link. Terms are locked while the proposal is pending.", cta: portal ? { label: "Open client portal", href: portal, external: true } : undefined };
  }
  if (p.status === "ACTIVE") {
    const pendingCr = p.changeRequests.find((c) => c.status === "PENDING_CLIENT");
    const openPr = p.paymentRequests.find((r) => r.status === "OPEN" || r.status === "PROCESSING");
    const eligible = p.milestones.find((m) => paymentEligibility(m, p.status).eligible);
    const submitted = p.milestones.find((m) => m.workStatus === "SUBMITTED");
    if (eligible) {
      return { tone: "action", title: `Request payment: ${eligible.title}`, body: `${formatMoney(eligible.amount, eligible.currency)} is ready to bill. Your client pays securely through PayPal.`, cta: { label: "Go to milestones", href: `${base}?tab=overview#milestones` } };
    }
    if (openPr) {
      return { tone: "waiting", title: `Awaiting payment of ${formatMoney(openPr.amount, openPr.currency)}`, body: "The payment updates here automatically once PayPal confirms the capture.", cta: portal ? { label: "Open client portal", href: portal, external: true } : undefined };
    }
    if (pendingCr) {
      return { tone: "waiting", title: `Change request #${pendingCr.number} awaits approval`, body: "Your client can approve or reject it in their portal.", cta: portal ? { label: "Open client portal", href: portal, external: true } : undefined };
    }
    if (submitted) {
      return { tone: "waiting", title: "Waiting for client review", body: `“${submitted.title}” was submitted. Once accepted, it becomes payable.` };
    }
    const unpaid = p.milestones.filter((m) => m.paymentStatus !== "PAID");
    if (unpaid.length === 0) return { tone: "done", title: "All milestones are paid", body: "Every approved milestone and change request has a verified payment." };
    return {
      tone: "action",
      title: "Deliver the work",
      body: "Mark milestones in progress and submit them for client review. New client requests? Run a scope check before saying yes.",
      cta: { label: "Run scope check", href: `${base}?tab=scope` },
    };
  }
  return { tone: "done", title: "Project closed", body: "" };
}

export function NextStep({ project, portal, tour }: { project: ProjectDetail; portal: string | null; tour: boolean }) {
  const s = decide(project, portal);
  const hasMilestones = project.milestones.length > 0;
  const Icon = s.tone === "done" ? CircleCheckBig : s.tone === "waiting" ? Clock : Lightbulb;
  return (
    <div
      data-testid="next-step"
      className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-indigo-100">
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-primary">{tour ? "Guided demo · next step" : "Next step"}</div>
          <div className="font-semibold">{s.title}</div>
          {s.body ? <p className="text-sm text-muted-foreground">{s.body}</p> : null}
        </div>
      </div>
      {s.cta ? (
        <Button asChild variant={s.tone === "action" ? "default" : "outline"} className="shrink-0">
          {s.cta.external ? (
            <a href={s.cta.href} target="_blank" rel="noopener">
              {s.cta.label} <ExternalLink />
            </a>
          ) : (
            <Link href={s.cta.href}>
              {s.cta.label} <ArrowRight />
            </Link>
          )}
        </Button>
      ) : null}
      {hasMilestones ? (
        <div className="flex flex-wrap gap-2 sm:basis-full sm:order-last" data-testid="feature-links">
          <Link href={`/app/projects/${project.id}?tab=timeline`} className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium text-primary hover:bg-indigo-50">
            <CalendarRange className="size-3.5" /> Smart timeline
          </Link>
          <Link href="/app/insights" className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium text-primary hover:bg-indigo-50">
            <BarChart3 className="size-3.5" /> Financial Intelligence
          </Link>
        </div>
      ) : null}
    </div>
  );
}
