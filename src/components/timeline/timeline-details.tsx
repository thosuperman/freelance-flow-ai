import type { Timeline, TimelineTask } from "@/features/timeline/build";

const LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted for review",
  CHANGES_REQUESTED: "Changes requested",
  ACCEPTED: "Accepted by client",
  UNPAID: "Not requested yet",
  REQUESTED: "Payment requested",
  PROCESSING: "Payment processing",
  PAID: "Paid (verified PayPal capture)",
};

/** Details panel for the selected timeline item. Plain text only; all values come from computed data. */
export function TimelineDetails({ task, timeline }: { task: TimelineTask | null; timeline: Timeline }) {
  if (!task) {
    return (
      <aside className="rounded-xl border bg-card p-4 text-sm text-muted-foreground" aria-live="polite">
        <p className="font-medium text-foreground">Select a bar</p>
        <p className="mt-1">Click a phase or payment in the timeline to see its dates, deliverables, approval and payment status.</p>
      </aside>
    );
  }
  const deps = timeline.dependencies.filter((d) => d.to === task.id || d.from === task.id);
  const name = (id: string) => timeline.tasks.find((t) => t.id === id)?.name ?? id;
  return (
    <aside className="space-y-3 rounded-xl border bg-card p-4 text-sm" aria-live="polite" data-testid="timeline-details">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {task.kind === "group" ? "Group" : task.kind === "payment" ? "Payment" : "Work phase"}
          {task.origin === "CHANGE_REQUEST" ? " · from approved change request" : ""}
        </p>
        <p className="mt-0.5 font-semibold">{task.name}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted-foreground">{task.kind === "payment" ? "Date" : "Dates"}</dt>
        <dd>{task.kind === "payment" ? task.startDate : `${task.startDate} → ${task.endDate}`}</dd>
        {task.baseline ? (
          <>
            <dt className="text-muted-foreground">Agreed</dt>
            <dd>
              ends {task.baseline.endDate}
              {task.slipDays ? <span className="ml-1 font-medium text-orange-700">+{task.slipDays} days</span> : null}
            </dd>
          </>
        ) : null}
        {task.amount ? (
          <>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="tabular-nums">
              {task.amount} {task.currency}
            </dd>
          </>
        ) : null}
        {task.workStatus && task.kind === "work" ? (
          <>
            <dt className="text-muted-foreground">Work</dt>
            <dd>{LABEL[task.workStatus] ?? task.workStatus}</dd>
          </>
        ) : null}
        {task.paymentStatus ? (
          <>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>{LABEL[task.paymentStatus] ?? task.paymentStatus}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Progress</dt>
        <dd>{task.percentDone}%</dd>
      </dl>
      {task.flags.late || task.flags.overduePayment || task.flags.affected || task.flags.missingDueDate ? (
        <ul className="space-y-1 rounded-md bg-amber-50 p-2 text-amber-900">
          {task.flags.late ? <li>Past its due date and not accepted yet.</li> : null}
          {task.flags.overduePayment ? <li>Payment request is overdue.</li> : null}
          {task.flags.affected ? <li>Depends on a late item, so it is at risk.</li> : null}
          {task.flags.missingDueDate ? <li>No due date set; shown as a 7-day placeholder.</li> : null}
        </ul>
      ) : null}
      {task.deliverables.length ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deliverables</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {task.deliverables.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {deps.length ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked to</p>
          <ul className="mt-1 space-y-0.5">
            {deps.map((d) => (
              <li key={d.id}>{d.to === task.id ? `after ${name(d.from)}` : `before ${name(d.to)}`}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
