import { CircleSlash, PackageCheck } from "lucide-react";
import type { ProjectDetail } from "@/features/projects/service";

export function ScopeList({ project }: { project: ProjectDetail }) {
  const crById = new Map(project.changeRequests.map((c) => [c.id, c]));
  const deliverables = project.scopeItems.filter((s) => s.kind === "DELIVERABLE" && (s.origin === "PROPOSAL" || crById.get(s.changeRequestId ?? "")?.status === "APPROVED"));
  const exclusions = project.scopeItems.filter((s) => s.kind === "EXCLUSION");
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-xs">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <PackageCheck className="size-4 text-primary" /> {project.status === "DRAFT" || project.status === "PROPOSED" ? "Proposed scope" : "Approved scope"}
        </h2>
        <ul className="space-y-2.5" data-testid="scope-deliverables">
          {deliverables.map((d) => (
            <li key={d.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{d.title}</span>
                {d.origin === "CHANGE_REQUEST" ? (
                  <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                    CR #{crById.get(d.changeRequestId!)?.number}
                  </span>
                ) : null}
              </div>
              {d.description ? <p className="text-xs text-muted-foreground">{d.description}</p> : null}
            </li>
          ))}
        </ul>
      </div>
      {exclusions.length ? (
        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <CircleSlash className="size-4 text-muted-foreground" /> Not included
          </h2>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {exclusions.map((e) => (
              <li key={e.id}>{e.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {project.acceptanceCriteria.length ? (
        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold">Acceptance criteria</h2>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {project.acceptanceCriteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
