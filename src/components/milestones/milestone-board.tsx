import { CalendarDays, Layers } from "lucide-react";
import { Money } from "@/components/shared/money";
import { StageBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { milestoneStage, paymentEligibility } from "@/features/milestones/rules";
import type { ProjectDetail } from "@/features/projects/service";
import { MilestoneActions } from "./milestone-actions";

const STAGES = ["Approved", "In progress", "Submitted", "Client approved", "Payment pending", "Paid"];

function formatDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
}

export function MilestoneBoard({ project }: { project: ProjectDetail }) {
  if (project.milestones.length === 0) {
    return <EmptyState icon={Layers} title="No milestones yet" description="Edit the project terms to add payment milestones." />;
  }
  return (
    <section id="milestones" aria-label="Milestones" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Milestones</h2>
        <div className="hidden items-center gap-1 text-[11px] text-muted-foreground 2xl:flex">
          {STAGES.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden>→</span> : null}
              {s}
            </span>
          ))}
        </div>
      </div>
      <ol className="space-y-3">
        {project.milestones.map((m) => {
          const stage = milestoneStage(m);
          const el = paymentEligibility(m, project.status);
          const openPr = project.paymentRequests.find((pr) => pr.milestoneId === m.id && (pr.status === "OPEN" || pr.status === "PROCESSING"));
          return (
            <li key={m.id} data-testid="milestone" data-milestone-title={m.title} className="rounded-2xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{m.position}</span>
                    <h3 className="font-semibold">{m.title}</h3>
                    <StageBadge stage={stage} />
                    {m.kind === "CHANGE_ORDER" ? <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">Change order</span> : null}
                    {m.kind === "DEPOSIT" ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Deposit</span> : null}
                  </div>
                  {m.description ? <p className="text-sm text-muted-foreground">{m.description}</p> : null}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                    {m.dueDate ? (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" /> Due {formatDate(m.dueDate)}
                      </span>
                    ) : null}
                    <span>{m.requiresDelivery ? "Payable after client accepts delivery" : "Payable once approved"}</span>
                    {m.submissionNote ? <span className="italic">Delivery note: “{m.submissionNote}”</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  <Money value={m.amount} currency={m.currency} className="text-lg font-semibold" />
                  <MilestoneActions
                    projectId={project.id}
                    milestone={{ id: m.id, title: m.title, workStatus: m.workStatus, termsStatus: m.termsStatus, requiresDelivery: m.requiresDelivery, paymentStatus: m.paymentStatus }}
                    projectActive={project.status === "ACTIVE"}
                    eligible={el.eligible}
                    ineligibleReason={el.eligible ? null : el.reason}
                    openRequestId={openPr && openPr.status === "OPEN" && !openPr.captureLockId ? openPr.id : null}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
