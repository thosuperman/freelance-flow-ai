import Link from "next/link";
import { ArrowRight, CircleCheck, FileText, Receipt } from "lucide-react";
import { getPortalProject, loadPortalProject } from "@/features/portal/service";
import { milestoneStage } from "@/features/milestones/rules";
import { reconcilePaymentRequest } from "@/features/payments/service";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { StageBadge, StatusBadge } from "@/components/shared/status-badge";
import { MilestoneReview } from "@/components/portal/milestone-review";
import { ChangeRequestDecision } from "@/components/portal/change-request-decision";
import { EnvironmentTag } from "@/components/payments/payments-panel";

export default async function PortalHome({ params }: PageProps<"/portal/[token]">) {
  const { token } = await params;
  let { project, grant, fin } = await getPortalProject(token);

  const uncertain = project.paymentRequests.filter((pr) => pr.attempts.some((a) => ["APPROVED", "CAPTURING", "PENDING"].includes(a.status)));
  if (uncertain.length) {
    for (const pr of uncertain) await reconcilePaymentRequest(pr.id);
    ({ project, grant, fin } = await loadPortalProject(token));
  }

  const versions = project.proposal?.versions ?? [];
  const pending = versions.find((v) => v.status === "PENDING");
  const approved = versions.find((v) => v.status === "APPROVED");
  const pendingCrs = project.changeRequests.filter((c) => c.status === "PENDING_CLIENT");
  const decidedCrs = project.changeRequests.filter((c) => c.status === "APPROVED" || c.status === "REJECTED");
  const submitted = project.milestones.filter((m) => m.workStatus === "SUBMITTED");
  const openRequests = project.paymentRequests.filter((r) => r.status === "OPEN" || r.status === "PROCESSING");
  const paidRequests = project.paymentRequests.filter((r) => r.status === "PAID");
  const actionCount = (pending ? 1 : 0) + pendingCrs.length + submitted.length + openRequests.filter((r) => r.status === "OPEN").length;
  const base = `/portal/${token}`;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <p className="text-sm text-muted-foreground">Hi {grant.client.name.split(" ")[0]},</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {actionCount ? `${actionCount} item${actionCount > 1 ? "s" : ""} need${actionCount > 1 ? "" : "s"} your attention.` : "You’re all caught up."}
        </p>
      </div>

      {approved ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="portal-financials">
          {[
            ["Original agreement", fin.originalValue],
            ["Approved changes", fin.approvedChanges],
            ["Paid", fin.paid],
            ["Remaining", fin.outstanding],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-xl border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground">{label as string}</div>
              <div className="mt-1 text-lg font-semibold">
                <Money value={v as never} currency={project.currency} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {pending ? (
        <section className="flex flex-col gap-4 rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-indigo-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <div className="font-semibold">Proposal ready for your review</div>
              <p className="text-sm text-muted-foreground">
                Version {pending.version} · total <Money value={pending.totalAmount} currency={pending.currency} />
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="h-10">
            <Link href={`${base}/proposal`} data-testid="review-proposal">
              Review proposal <ArrowRight />
            </Link>
          </Button>
        </section>
      ) : null}

      {pendingCrs.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Change requests awaiting your decision</h2>
          {pendingCrs.map((cr) => (
            <ChangeRequestDecision
              key={cr.id}
              token={token}
              cr={{
                id: cr.id,
                number: cr.number,
                title: cr.title,
                description: cr.description,
                deliverables: cr.deliverables as { title: string; description: string }[],
                amount: cr.amount.toFixed(2),
                currency: cr.currency,
                billingTiming: cr.billingTiming,
                termsHash: cr.termsHash!,
              }}
              defaultName={grant.client.name}
              revisedTotal={fin.revisedValue.plus(cr.amount).toFixed(2)}
            />
          ))}
        </section>
      ) : null}

      {openRequests.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Payment requests</h2>
          {openRequests.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between" data-testid="portal-payment-request">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {r.milestone.title} <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-muted-foreground">Due {r.dueDate.toLocaleDateString("en-US", { dateStyle: "medium" })}</div>
              </div>
              <div className="flex items-center gap-3">
                <Money value={r.amount} currency={r.currency} className="text-lg font-semibold" />
                {r.status === "OPEN" ? (
                  <Button asChild>
                    <Link href={`${base}/pay/${r.id}`} data-testid="pay-now">
                      Pay with PayPal
                    </Link>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">PayPal is finalising this payment</span>
                )}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {submitted.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Deliveries to review</h2>
          {submitted.map((m) => (
            <MilestoneReview
              key={m.id}
              token={token}
              milestone={{ id: m.id, title: m.title, description: m.description, note: m.submissionNote, amount: m.amount.toFixed(2), currency: m.currency }}
              defaultName={grant.client.name}
            />
          ))}
        </section>
      ) : null}

      {approved ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Milestones</h2>
            <Link href={`${base}/proposal`} className="text-xs font-medium text-primary hover:underline">
              View approved proposal
            </Link>
          </div>
          <ul className="divide-y rounded-2xl border bg-card shadow-xs">
            {project.milestones
              .filter((m) => m.termsStatus === "APPROVED")
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.dueDate ? `Due ${m.dueDate.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Money value={m.amount} currency={m.currency} className="text-sm font-medium" />
                    <StageBadge stage={milestoneStage(m)} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {decidedCrs.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Change history</h2>
          <ul className="space-y-1.5 text-sm">
            {decidedCrs.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5">
                <span>
                  CR #{c.number}: {c.title}
                </span>
                <span className="flex items-center gap-2">
                  <Money value={c.amount} currency={c.currency} className="text-xs" /> <StatusBadge status={c.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {paidRequests.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Receipts</h2>
          <ul className="space-y-1.5">
            {paidRequests.map((r) => {
              const t = r.transactions.find((x) => x.status === "COMPLETED");
              return (
                <li key={r.id}>
                  <Link
                    href={`${base}/receipt/${r.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
                    data-testid="receipt-link"
                  >
                    <span className="flex items-center gap-2">
                      <Receipt className="size-4 text-emerald-600" /> {r.milestone.title}
                      {t ? <EnvironmentTag env={t.environment} /> : null}
                    </span>
                    <Money value={r.amount} currency={r.currency} className="font-medium" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!pending && !approved ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          <CircleCheck className="size-4" /> There is nothing to review right now. You’ll see the proposal here once it’s sent.
        </div>
      ) : null}
    </div>
  );
}
