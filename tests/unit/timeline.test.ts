import { describe, expect, it } from "vitest";
import { buildTimeline, type TimelineSource } from "@/features/timeline/build";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

function source(over: Partial<TimelineSource> = {}): TimelineSource {
  return {
    today: d("2026-11-10"),
    project: { startDate: d("2026-11-01"), createdAt: d("2026-10-30"), currency: "USD" },
    baseline: {
      version: 1,
      approvedAt: d("2026-11-01"),
      milestones: [
        { id: "m1", dueDate: "2026-11-01" },
        { id: "m2", dueDate: "2026-11-07" },
        { id: "m3", dueDate: "2026-11-14" },
      ],
    },
    milestones: [
      { id: "m1", position: 0, kind: "DEPOSIT", title: "Upfront deposit", amount: "450.00", currency: "USD", dueDate: d("2026-11-01"), termsStatus: "APPROVED", workStatus: "NOT_STARTED", paymentStatus: "PAID", changeRequestId: null },
      { id: "m2", position: 1, kind: "DELIVERY", title: "Initial design", amount: "0.00", currency: "USD", dueDate: d("2026-11-07"), termsStatus: "APPROVED", workStatus: "ACCEPTED", paymentStatus: "UNPAID", changeRequestId: null },
      { id: "m3", position: 2, kind: "DELIVERY", title: "Final delivery", amount: "1050.00", currency: "USD", dueDate: d("2026-11-14"), termsStatus: "APPROVED", workStatus: "IN_PROGRESS", paymentStatus: "UNPAID", changeRequestId: null },
    ],
    changeRequests: [],
    paymentRequests: [{ id: "pr1", milestoneId: "m1", dueDate: d("2026-11-01"), status: "PAID", paidAt: d("2026-11-01") }],
    scopeItems: [
      { kind: "DELIVERABLE", title: "Landing page design", milestoneId: "m2", changeRequestId: null },
      { kind: "DELIVERABLE", title: "Final landing page", milestoneId: "m3", changeRequestId: null },
    ],
    ...over,
  };
}

describe("Smart Milestone Timeline", () => {
  it("maps milestones to sequential work phases with payment markers and dependencies", () => {
    const t = buildTimeline(source());
    const design = t.tasks.find((x) => x.id === "work:m2")!;
    const final = t.tasks.find((x) => x.id === "work:m3")!;
    expect(design).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-08", percentDone: 100, deliverables: ["Landing page design"] });
    expect(final).toMatchObject({ startDate: "2026-11-08", endDate: "2026-11-15", percentDone: 50 });
    expect(t.tasks.find((x) => x.id === "pay:m1")).toMatchObject({ kind: "payment", startDate: "2026-11-01", percentDone: 100, amount: "450.00" });
    expect(t.tasks.find((x) => x.id === "pay:m3")).toMatchObject({ kind: "payment", startDate: "2026-11-14", amount: "1050.00" });
    // zero-value milestones get no payment marker
    expect(t.tasks.find((x) => x.id === "pay:m2")).toBeUndefined();
    expect(t.dependencies.map((x) => [x.from, x.to, x.reason])).toEqual([
      ["pay:m1", "work:m2", "deposit"],
      ["work:m2", "work:m3", "sequence"],
      ["work:m3", "pay:m3", "payment"],
    ]);
    expect(t.endDate).toBe("2026-11-15");
    expect(t.baselineEndDate).toBe("2026-11-15");
  });

  it("uses the approved proposal snapshot as the baseline and reports slippage", () => {
    const src = source();
    src.milestones[2]!.dueDate = d("2026-11-17"); // three days later than agreed
    const final = buildTimeline(src).tasks.find((x) => x.id === "work:m3")!;
    expect(final.baseline).toEqual({ startDate: "2026-11-08", endDate: "2026-11-15" });
    expect(final.slipDays).toBe(3);
  });

  it("adds approved change requests as their own phase without rewriting the original agreement", () => {
    const src = source({
      changeRequests: [{ id: "cr1", number: 1, title: "Booking system", status: "APPROVED", decidedAt: d("2026-11-09"), dueDate: d("2026-11-17") }],
    });
    src.milestones.push({ id: "m4", position: 3, kind: "CHANGE_ORDER", title: "Booking system", amount: "300.00", currency: "USD", dueDate: d("2026-11-17"), termsStatus: "APPROVED", workStatus: "NOT_STARTED", paymentStatus: "UNPAID", changeRequestId: "cr1" });
    src.scopeItems.push({ kind: "DELIVERABLE", title: "Consultation booking widget", milestoneId: null, changeRequestId: "cr1" });
    const t = buildTimeline(src);
    const cr = t.tasks.find((x) => x.id === "work:m4")!;
    expect(cr).toMatchObject({ origin: "CHANGE_REQUEST", parentId: "group:changes", changeRequestNumber: 1, startDate: "2026-11-09", endDate: "2026-11-18", deliverables: ["Consultation booking widget"], baseline: null });
    expect(t.changes).toEqual([{ number: 1, title: "Booking system", approvedOn: "2026-11-09", endDate: "2026-11-17", extendsScheduleByDays: 3 }]);
    expect(t.endDate).toBe("2026-11-18");
    // the agreement itself is unchanged
    expect(t.baselineEndDate).toBe("2026-11-15");
    expect(t.tasks.find((x) => x.id === "work:m3")!.endDate).toBe("2026-11-15");
  });

  it("ignores change-order milestones that are not approved", () => {
    const src = source();
    src.milestones.push({ id: "m5", position: 4, kind: "CHANGE_ORDER", title: "Pending", amount: "100.00", currency: "USD", dueDate: null, termsStatus: "DRAFT", workStatus: "NOT_STARTED", paymentStatus: "UNPAID", changeRequestId: "x" });
    expect(buildTimeline(src).tasks.some((x) => x.milestoneId === "m5")).toBe(false);
  });

  it("flags late work and marks downstream milestones and payments as affected", () => {
    const src = source({ today: d("2026-11-12") });
    src.milestones[1]!.workStatus = "IN_PROGRESS"; // design was due 11-07
    const t = buildTimeline(src);
    expect(t.risks.late).toEqual(["work:m2"]);
    expect(t.risks.affected.sort()).toEqual(["pay:m3", "work:m3"]);
    expect(t.tasks.find((x) => x.id === "work:m3")!.flags.affected).toBe(true);
  });

  it("flags overdue payment requests and the work that depends on them", () => {
    const src = source({
      paymentRequests: [{ id: "pr1", milestoneId: "m1", dueDate: d("2026-11-03"), status: "OPEN", paidAt: null }],
    });
    src.milestones[0]!.paymentStatus = "REQUESTED";
    src.milestones[1]!.workStatus = "NOT_STARTED";
    src.milestones[1]!.dueDate = d("2026-11-20");
    src.milestones[2]!.dueDate = d("2026-11-27");
    const t = buildTimeline(src);
    expect(t.risks.overduePayments).toEqual([{ taskId: "pay:m1", milestoneTitle: "Upfront deposit", amount: "450.00", currency: "USD", dueDate: "2026-11-03" }]);
    expect(t.risks.affected).toContain("work:m2");
  });

  it("gives milestones without a due date a visible placeholder span", () => {
    const src = source({ baseline: null });
    src.milestones[2]!.dueDate = null;
    const final = buildTimeline(src).tasks.find((x) => x.id === "work:m3")!;
    expect(final.flags.missingDueDate).toBe(true);
    expect(final.endDate).toBe("2026-11-15");
  });

  it("keeps payment amounts in the milestone's own currency with decimal formatting", () => {
    const src = source();
    for (const m of src.milestones) m.currency = "JPY";
    src.milestones[2]!.amount = "105000";
    const pay = buildTimeline(src).tasks.find((x) => x.id === "pay:m3")!;
    expect(pay).toMatchObject({ amount: "105000", currency: "JPY" });
  });
});
