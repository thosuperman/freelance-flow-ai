import { FileDiff, ShieldCheck } from "lucide-react";
import { sum } from "@/lib/money";
import type { ProjectDetail } from "@/features/projects/service";
import { approvedScopeRefs } from "@/features/ai/service";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScopeChecker } from "./scope-checker";
import { ChangeRequestActions } from "./change-request-actions";

export function ScopePanel({ project, example, ai, hourlyRate }: { project: ProjectDetail; example: string; ai: { simulated: boolean }; hourlyRate: string | null }) {
  if (project.status !== "ACTIVE" && project.status !== "COMPLETED") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Scope protection starts after approval"
        description="Once your client approves the proposal, paste any new request here and AI will check it against exactly what was agreed."
      />
    );
  }
  const scope = approvedScopeRefs(project);
  return (
    <div className="space-y-8">
      <ScopeChecker
        projectId={project.id}
        currency={project.currency}
        scope={scope}
        example={example}
        simulated={ai.simulated}
        hourlyRate={hourlyRate}
      />
      <section className="space-y-3" aria-label="Change requests">
        <h2 className="text-sm font-semibold">Change requests</h2>
        {project.changeRequests.length === 0 ? (
          <EmptyState icon={FileDiff} title="No change requests yet" description="Out-of-scope work becomes a change request your client approves before you start." />
        ) : (
          <ul className="space-y-3">
            {project.changeRequests.map((cr) => {
              const items = cr.deliverables as { title: string; description: string }[];
              return (
                <li key={cr.id} className="rounded-2xl border bg-card p-4 shadow-xs" data-testid="change-request">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">CR #{cr.number}</span>
                        <h3 className="font-semibold">{cr.title}</h3>
                        <StatusBadge status={cr.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{cr.description}</p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {items.map((d) => (
                          <li key={d.title}>
                            <span className="font-medium text-foreground">{d.title}</span>
                            {d.description ? ` — ${d.description}` : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="pt-1 text-xs text-muted-foreground">
                        {cr.billingTiming === "ON_APPROVAL" ? "Billed once approved" : "Billed after delivery is accepted"}
                        {cr.analysis ? ` · detected by ${cr.analysis.provider === "simulated" ? "simulated AI" : "AI"} scope check` : ""}
                        {cr.clientNote ? ` · Client note: “${cr.clientNote}”` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Money value={cr.amount} currency={cr.currency} className="text-lg font-semibold" />
                      <ChangeRequestActions projectId={project.id} id={cr.id} status={cr.status} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Approved change requests are added to the scope as new items. The original approved proposal is never modified. Total approved changes:{" "}
          <span className="font-medium text-foreground">
            <Money value={sum(project.changeRequests.filter((c) => c.status === "APPROVED").map((c) => c.amount))} currency={project.currency} />
          </span>
        </p>
      </section>
    </div>
  );
}
