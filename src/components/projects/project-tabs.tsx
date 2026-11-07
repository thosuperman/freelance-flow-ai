import Link from "next/link";
import { cn } from "@/lib/utils";

const LABELS = { overview: "Overview", proposal: "Proposal", scope: "Scope & changes", payments: "Payments", activity: "Activity" } as const;

export function ProjectTabs({ projectId, active, counts }: { projectId: string; active: keyof typeof LABELS; counts: { scope: number; payments: number } }) {
  return (
    <nav aria-label="Project sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full gap-1 border-b sm:min-w-0">
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((key) => {
          const count = key === "scope" ? counts.scope : key === "payments" ? counts.payments : 0;
          return (
            <Link
              key={key}
              href={`/app/projects/${projectId}?tab=${key}`}
              aria-current={active === key ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {LABELS[key]}
              {count ? <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{count}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
