import { CalendarRange } from "lucide-react";
import type { Timeline } from "@/features/timeline/build";
import { EmptyState } from "@/components/shared/empty-state";
import { TimelineLoader } from "./timeline-loader";
import { TimelineInsight } from "./timeline-insight";

export function TimelinePanel({ projectId, timeline }: { projectId: string; timeline: Timeline }) {
  const hasWork = timeline.tasks.some((t) => t.kind !== "group");
  if (!hasWork) {
    return <EmptyState icon={CalendarRange} title="No milestones yet" description="Add milestones to the project terms to see the delivery and payment timeline." />;
  }
  const late = timeline.tasks.filter((t) => t.flags.late).length;
  const overdue = timeline.risks.overduePayments.length;
  const slip = timeline.baselineEndDate ? Math.round((Date.parse(timeline.endDate) - Date.parse(timeline.baselineEndDate)) / 86_400_000) : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Planned finish" value={lastDay(timeline.endDate)} hint={timeline.baselineEndDate ? `Agreed: ${lastDay(timeline.baselineEndDate)}${slip > 0 ? ` (+${slip} days)` : ""}` : "No approved agreement yet"} />
        <Fact label="Approved changes" value={String(timeline.changes.length)} hint={timeline.changes.length ? timeline.changes.map((c) => `CR #${c.number}${c.extendsScheduleByDays ? ` +${c.extendsScheduleByDays}d` : ""}`).join(", ") : "Original scope only"} />
        <Fact label="Late phases" value={String(late)} hint={timeline.risks.affected.length ? `${timeline.risks.affected.length} downstream item(s) at risk` : "Nothing downstream at risk"} tone={late ? "bad" : "ok"} />
        <Fact label="Payments pending" value={String(timeline.risks.pendingPayments.length)} hint={overdue ? `${overdue} overdue` : "None overdue"} tone={overdue ? "bad" : "ok"} />
      </div>
      <TimelineLoader timeline={timeline} />
      <TimelineInsight projectId={projectId} />
      <p className="text-xs text-muted-foreground">
        The timeline is built from approved milestones, the approved proposal (dashed baseline), approved change requests and PayPal payment requests. It is read-only: approved dates change only through a change request your client approves.
      </p>
    </div>
  );
}

function lastDay(exclusiveEnd: string) {
  return new Date(Date.parse(`${exclusiveEnd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

function Fact({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "bad" ? "text-red-700" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
