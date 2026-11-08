import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { createChangeRequest, decideChangeRequest, sendChangeRequest } from "@/features/scope-changes/service";
import { explainProjectTimeline, getProjectTimeline } from "@/features/timeline/service";
import { createApprovedProject, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("Smart Milestone Timeline (persisted data)", () => {
  it("builds the timeline from the approved agreement and adds approved change requests", async () => {
    const user = await createUser({ hourlyRate: "50.00" });
    const { project, grant } = await createApprovedProject(user.id);

    const before = await getProjectTimeline(user.id, project.id);
    expect(before.tasks.find((t) => t.id === "group:agreement")?.name).toMatch(/proposal v1/);
    const work = before.tasks.filter((t) => t.kind === "work");
    expect(work.length).toBeGreaterThan(0);
    // The fixture's agreed milestones have no due dates: no baseline bars, placeholders flagged.
    expect(work.every((t) => t.baseline === null && t.flags.missingDueDate)).toBe(true);
    expect(before.baselineEndDate).toBeNull();
    expect(before.changes).toEqual([]);

    const cr = await createChangeRequest(user.id, project.id, {
      title: "Booking system",
      description: "Consultation booking on the landing page",
      deliverables: [{ title: "Booking widget", description: "Embedded booking form" }],
      requestText: "Can you also add a booking system?",
      amount: "300.00",
      billingTiming: "ON_APPROVAL",
      dueDate: "2099-01-10",
    });
    await sendChangeRequest(user.id, cr.id);
    const sent = await db.scopeChangeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    await decideChangeRequest(grant, { changeRequestId: cr.id, termsHash: sent.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null);

    const after = await getProjectTimeline(user.id, project.id);
    const change = after.tasks.find((t) => t.origin === "CHANGE_REQUEST" && t.kind === "work");
    expect(change).toMatchObject({ changeRequestNumber: 1, amount: "300.00", currency: "USD", baseline: null });
    expect(change!.deliverables).toContain("Booking widget");
    expect(after.changes[0]).toMatchObject({ number: 1, title: "Booking system", endDate: "2099-01-10" });
    // The agreed baseline is unchanged by the change request.
    expect(after.baselineEndDate).toBe(before.baselineEndDate);
    expect(after.endDate > before.endDate).toBe(true);
  });

  it("is only visible to the project owner", async () => {
    const owner = await createUser();
    const mallory = await createUser();
    const { project } = await createApprovedProject(owner.id);
    await expect(getProjectTimeline(mallory.id, project.id)).rejects.toBeInstanceOf(DomainError);
    await expect(explainProjectTimeline(mallory, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stores the AI schedule explanation without changing any milestone", async () => {
    const user = await createUser();
    const { project } = await createApprovedProject(user.id);
    const before = await db.milestone.findMany({ where: { projectId: project.id }, orderBy: { position: "asc" } });
    const r = await explainProjectTimeline(user, project.id);
    expect(r.simulated).toBe(true);
    expect(r.data.headline.length).toBeGreaterThan(0);
    const row = await db.aIAnalysis.findUniqueOrThrow({ where: { id: r.analysisId } });
    expect(row).toMatchObject({ kind: "TIMELINE_INSIGHT", succeeded: true, projectId: project.id });
    const after = await db.milestone.findMany({ where: { projectId: project.id }, orderBy: { position: "asc" } });
    expect(after.map((m) => [m.dueDate, m.amount.toString()])).toEqual(before.map((m) => [m.dueDate, m.amount.toString()]));
  });
});
