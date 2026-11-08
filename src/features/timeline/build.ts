import { dec, toAmountString } from "@/lib/money";

/**
 * Smart Milestone Timeline: derives a Gantt-ready plan from persisted project records.
 *
 * Nothing here is stored or edited. Dates come from approved milestones, the approved proposal
 * snapshot (baseline), approved change requests and payment requests; risk flags are computed by
 * code. The timeline is read-only on purpose: changing an approved date is a change to agreed terms
 * and goes through a change request that the client approves.
 */

type Amount = { toString(): string } | string;

export type TimelineSource = {
  today: Date;
  project: { startDate: Date | null; createdAt: Date; currency: string };
  /** Approved proposal version: its approval time and the milestone dates the client agreed to. */
  baseline: { version: number; approvedAt: Date | null; milestones: { id: string; dueDate: string | null }[] } | null;
  milestones: {
    id: string;
    position: number;
    kind: "DEPOSIT" | "DELIVERY" | "CHANGE_ORDER";
    title: string;
    amount: Amount;
    currency: string;
    dueDate: Date | null;
    termsStatus: "DRAFT" | "APPROVED";
    workStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "CHANGES_REQUESTED" | "ACCEPTED";
    paymentStatus: "UNPAID" | "REQUESTED" | "PROCESSING" | "PAID";
    changeRequestId: string | null;
  }[];
  changeRequests: { id: string; number: number; title: string; status: string; decidedAt: Date | null; dueDate: Date | null }[];
  paymentRequests: { id: string; milestoneId: string; dueDate: Date; status: string; paidAt: Date | null }[];
  scopeItems: { kind: string; title: string; milestoneId: string | null; changeRequestId: string | null }[];
};

export type TaskKind = "group" | "work" | "payment";
export type TaskOrigin = "AGREEMENT" | "CHANGE_REQUEST";

export type TimelineTask = {
  id: string;
  parentId: string | null;
  kind: TaskKind;
  origin: TaskOrigin;
  name: string;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // exclusive end for work; equal to start for payment markers
  percentDone: number;
  milestoneId: string | null;
  changeRequestNumber: number | null;
  amount: string | null;
  currency: string | null;
  workStatus: string | null;
  paymentStatus: string | null;
  deliverables: string[];
  baseline: { startDate: string; endDate: string } | null;
  /** Days the current end is later than the agreed (baseline) end; 0 when on plan or no baseline. */
  slipDays: number;
  flags: { late: boolean; overduePayment: boolean; affected: boolean; missingDueDate: boolean };
};

export type TimelineDependency = { id: string; from: string; to: string; reason: "sequence" | "payment" | "deposit" };

export type Timeline = {
  startDate: string;
  endDate: string;
  baselineEndDate: string | null;
  tasks: TimelineTask[];
  dependencies: TimelineDependency[];
  risks: {
    late: string[];
    affected: string[];
    overduePayments: { taskId: string; milestoneTitle: string; amount: string; currency: string; dueDate: string }[];
    pendingPayments: { taskId: string; milestoneTitle: string; amount: string; currency: string; dueDate: string; status: string }[];
  };
  changes: { number: number; title: string; approvedOn: string | null; endDate: string; extendsScheduleByDays: number }[];
};

const DAY = 86_400_000;
const WORK_PROGRESS: Record<TimelineSource["milestones"][number]["workStatus"], number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 50,
  CHANGES_REQUESTED: 60,
  SUBMITTED: 80,
  ACCEPTED: 100,
};

export function dayOf(d: Date | string): string {
  return (typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d).toISOString().slice(0, 10);
}
function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);
}
const maxDay = (a: string, b: string) => (a > b ? a : b);

export function buildTimeline(src: TimelineSource): Timeline {
  const today = dayOf(src.today);
  const projectStart = dayOf(src.project.startDate ?? src.baseline?.approvedAt ?? src.project.createdAt);
  const baselineDue = new Map((src.baseline?.milestones ?? []).map((m) => [m.id, m.dueDate]));
  const paymentByMilestone = new Map<string, TimelineSource["paymentRequests"][number]>();
  for (const pr of [...src.paymentRequests].sort((a, b) => +a.dueDate - +b.dueDate)) {
    // Prefer the paid request; otherwise the latest open one.
    const current = paymentByMilestone.get(pr.milestoneId);
    if (!current || current.status !== "PAID") paymentByMilestone.set(pr.milestoneId, pr);
  }
  const deliverablesFor = (milestoneId: string, changeRequestId: string | null) =>
    src.scopeItems
      .filter((s) => s.kind === "DELIVERABLE" && (s.milestoneId === milestoneId || (changeRequestId && s.changeRequestId === changeRequestId)))
      .map((s) => s.title);

  const tasks: TimelineTask[] = [];
  const deps: TimelineDependency[] = [];
  const AGREEMENT = "group:agreement";
  const CHANGES = "group:changes";

  const blank = (over: Partial<TimelineTask> & Pick<TimelineTask, "id" | "name" | "kind" | "origin" | "startDate" | "endDate">): TimelineTask => ({
    parentId: null,
    percentDone: 0,
    milestoneId: null,
    changeRequestNumber: null,
    amount: null,
    currency: null,
    workStatus: null,
    paymentStatus: null,
    deliverables: [],
    baseline: null,
    slipDays: 0,
    flags: { late: false, overduePayment: false, affected: false, missingDueDate: false },
    ...over,
  });

  const paymentTask = (m: TimelineSource["milestones"][number], parentId: string, origin: TaskOrigin, fallbackDay: string, crNumber: number | null) => {
    const pr = paymentByMilestone.get(m.id);
    const day = pr?.paidAt ? dayOf(pr.paidAt) : pr ? dayOf(pr.dueDate) : fallbackDay;
    const open = pr && (pr.status === "OPEN" || pr.status === "PROCESSING");
    const task = blank({
      id: `pay:${m.id}`,
      parentId,
      kind: "payment",
      origin,
      name: `Payment · ${m.title}`,
      startDate: day,
      endDate: day,
      percentDone: m.paymentStatus === "PAID" ? 100 : 0,
      milestoneId: m.id,
      changeRequestNumber: crNumber,
      amount: toAmountString(dec(m.amount.toString()), m.currency),
      currency: m.currency,
      paymentStatus: m.paymentStatus,
      flags: { late: false, overduePayment: Boolean(open && day < today), affected: false, missingDueDate: false },
    });
    tasks.push(task);
    return task;
  };

  // ── Original agreement ───────────────────────────────────────────────
  const original = src.milestones.filter((m) => m.kind !== "CHANGE_ORDER").sort((a, b) => a.position - b.position);
  tasks.push(blank({ id: AGREEMENT, name: src.baseline ? `Original agreement (proposal v${src.baseline.version})` : "Draft plan (not yet approved)", kind: "group", origin: "AGREEMENT", startDate: projectStart, endDate: projectStart }));

  let cursor = projectStart;
  let baselineCursor = projectStart;
  let hasAgreedDates = false;
  let previousWork: string | null = null;
  let depositTask: TimelineTask | null = null;
  for (const m of original) {
    if (m.kind === "DEPOSIT") {
      depositTask = paymentTask(m, AGREEMENT, "AGREEMENT", m.dueDate ? dayOf(m.dueDate) : projectStart, null);
      continue;
    }
    const start = cursor;
    const missingDueDate = !m.dueDate;
    let end = m.dueDate ? addDays(dayOf(m.dueDate), 1) : addDays(start, 7);
    if (end <= start) end = addDays(start, 1);
    const agreed = baselineDue.get(m.id);
    const baseline = agreed ? { startDate: baselineCursor, endDate: addDays(agreed, 1) } : null;
    if (agreed) {
      baselineCursor = addDays(agreed, 1);
      hasAgreedDates = true;
    }
    const task = blank({
      id: `work:${m.id}`,
      parentId: AGREEMENT,
      kind: "work",
      origin: "AGREEMENT",
      name: m.title,
      startDate: start,
      endDate: end,
      percentDone: WORK_PROGRESS[m.workStatus],
      milestoneId: m.id,
      amount: toAmountString(dec(m.amount.toString()), m.currency),
      currency: m.currency,
      workStatus: m.workStatus,
      paymentStatus: m.paymentStatus,
      deliverables: deliverablesFor(m.id, null),
      baseline,
      slipDays: baseline ? Math.max(0, diffDays(end, baseline.endDate)) : 0,
      flags: { late: m.workStatus !== "ACCEPTED" && addDays(end, -1) < today, overduePayment: false, affected: false, missingDueDate },
    });
    tasks.push(task);
    if (previousWork) deps.push({ id: `dep:${previousWork}->${task.id}`, from: previousWork, to: task.id, reason: "sequence" });
    else if (depositTask) deps.push({ id: `dep:${depositTask.id}->${task.id}`, from: depositTask.id, to: task.id, reason: "deposit" });
    if (dec(m.amount.toString()).gt(0)) {
      const pay = paymentTask(m, AGREEMENT, "AGREEMENT", addDays(end, -1), null);
      deps.push({ id: `dep:${task.id}->${pay.id}`, from: task.id, to: pay.id, reason: "payment" });
    }
    previousWork = task.id;
    cursor = end;
  }
  const agreementEnd = cursor;
  const baselineEnd = src.baseline && hasAgreedDates ? baselineCursor : null;

  // ── Approved change requests ─────────────────────────────────────────
  const changeOrders = src.milestones.filter((m) => m.kind === "CHANGE_ORDER" && m.termsStatus === "APPROVED");
  const changes: Timeline["changes"] = [];
  if (changeOrders.length) {
    tasks.push(blank({ id: CHANGES, name: "Approved changes", kind: "group", origin: "CHANGE_REQUEST", startDate: agreementEnd, endDate: agreementEnd }));
    for (const m of changeOrders.sort((a, b) => a.position - b.position)) {
      const cr = src.changeRequests.find((c) => c.id === m.changeRequestId) ?? null;
      const approvedOn = cr?.decidedAt ? dayOf(cr.decidedAt) : null;
      const start = maxDay(projectStart, approvedOn ?? projectStart);
      const due = m.dueDate ?? cr?.dueDate ?? null;
      let end = due ? addDays(dayOf(due), 1) : addDays(start, 7);
      if (end <= start) end = addDays(start, 1);
      const task = blank({
        id: `work:${m.id}`,
        parentId: CHANGES,
        kind: "work",
        origin: "CHANGE_REQUEST",
        name: cr ? `CR #${cr.number}: ${cr.title}` : m.title,
        startDate: start,
        endDate: end,
        percentDone: WORK_PROGRESS[m.workStatus],
        milestoneId: m.id,
        changeRequestNumber: cr?.number ?? null,
        amount: toAmountString(dec(m.amount.toString()), m.currency),
        currency: m.currency,
        workStatus: m.workStatus,
        paymentStatus: m.paymentStatus,
        deliverables: deliverablesFor(m.id, m.changeRequestId),
        flags: { late: m.workStatus !== "ACCEPTED" && addDays(end, -1) < today, overduePayment: false, affected: false, missingDueDate: !due },
      });
      tasks.push(task);
      const pay = paymentTask(m, CHANGES, "CHANGE_REQUEST", addDays(end, -1), cr?.number ?? null);
      deps.push({ id: `dep:${task.id}->${pay.id}`, from: task.id, to: pay.id, reason: "payment" });
      changes.push({
        number: cr?.number ?? 0,
        title: cr?.title ?? m.title,
        approvedOn,
        endDate: addDays(end, -1),
        extendsScheduleByDays: Math.max(0, diffDays(end, agreementEnd)),
      });
    }
  }

  // ── Group spans, risk propagation ────────────────────────────────────
  for (const g of tasks.filter((t) => t.kind === "group")) {
    const children = tasks.filter((t) => t.parentId === g.id);
    if (!children.length) continue;
    g.startDate = children.reduce((a, t) => (t.startDate < a ? t.startDate : a), children[0]!.startDate);
    g.endDate = children.reduce((a, t) => maxDay(a, t.kind === "payment" ? addDays(t.endDate, 1) : t.endDate), children[0]!.endDate);
    const work = children.filter((t) => t.kind === "work");
    g.percentDone = work.length ? Math.round(work.reduce((a, t) => a + t.percentDone, 0) / work.length) : 0;
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const late = tasks.filter((t) => t.flags.late || t.flags.overduePayment).map((t) => t.id);
  const affected = new Set<string>();
  const queue = [...late];
  while (queue.length) {
    const id = queue.shift()!;
    for (const d of deps.filter((x) => x.from === id)) {
      const next = byId.get(d.to);
      if (next && !affected.has(next.id) && !late.includes(next.id) && next.percentDone < 100) {
        affected.add(next.id);
        next.flags.affected = true;
        queue.push(next.id);
      }
    }
  }

  const payments = tasks.filter((t) => t.kind === "payment");
  const label = (t: TimelineTask) => src.milestones.find((m) => m.id === t.milestoneId)?.title ?? t.name;
  const endDate = tasks.reduce((a, t) => maxDay(a, t.kind === "payment" ? addDays(t.endDate, 1) : t.endDate), projectStart);

  return {
    startDate: projectStart,
    endDate,
    baselineEndDate: baselineEnd,
    tasks,
    dependencies: deps,
    risks: {
      late,
      affected: [...affected],
      overduePayments: payments
        .filter((t) => t.flags.overduePayment)
        .map((t) => ({ taskId: t.id, milestoneTitle: label(t), amount: t.amount!, currency: t.currency!, dueDate: t.startDate })),
      pendingPayments: payments
        .filter((t) => t.paymentStatus !== "PAID")
        .map((t) => ({ taskId: t.id, milestoneTitle: label(t), amount: t.amount!, currency: t.currency!, dueDate: t.startDate, status: t.paymentStatus! })),
    },
    changes,
  };
}
