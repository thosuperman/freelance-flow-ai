import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createProject } from "@/features/projects/service";
import { answerFinancialQuestion } from "@/features/ai/service";
import { buildFinancialDataset } from "@/features/insights/data";
import { createChangeRequest, decideChangeRequest, sendChangeRequest } from "@/features/scope-changes/service";
import { createApprovedProject, createUser, DEMO_TERMS, resetDb } from "./helpers";

beforeEach(resetDb);

describe("Financial Intelligence dataset", () => {
  it("derives revenue, scope-change and outstanding figures from approved records", async () => {
    const user = await createUser({ hourlyRate: "50.00" });
    const { project, grant } = await createApprovedProject(user.id);
    const cr = await createChangeRequest(user.id, project.id, {
      title: "Booking system",
      description: "Booking",
      deliverables: [{ title: "Booking widget", description: "" }],
      requestText: "Add booking",
      amount: "300.00",
      billingTiming: "ON_APPROVAL",
    });
    await sendChangeRequest(user.id, cr.id);
    const sent = await db.scopeChangeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    await decideChangeRequest(grant, { changeRequestId: cr.id, termsHash: sent.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null);

    const d = await buildFinancialDataset(user.id);
    expect(d.currencies).toEqual(["USD"]);
    expect(d.projects[0]).toMatchObject({ originalValue: 1500, approvedChanges: 300, revisedValue: 1800, paid: 0, outstanding: 1800 });
    expect(d.changeRequests[0]).toMatchObject({ status: "APPROVED", approvedAmount: 300, currency: "USD" });
    expect(d.milestones.some((m) => m.kind === "Change order" && m.amount === 300)).toBe(true);
    const fact = (id: string) => d.facts.find((f) => f.id === id)?.value;
    expect(fact("USD:changes")).toBe("300.00 USD");
    expect(fact("USD:contracted")).toBe("1800.00 USD");
    expect(fact("USD:outstanding")).toBe("1800.00 USD");
  });

  it("keeps currencies separate", async () => {
    const user = await createUser();
    await createApprovedProject(user.id);
    await createProject(user.id, { ...DEMO_TERMS, title: "EUR project", currency: "EUR" });
    const d = await buildFinancialDataset(user.id);
    expect(d.currencies).toEqual(["EUR", "USD"]);
    expect(d.facts.filter((f) => f.id.endsWith(":contracted")).map((f) => f.value).sort()).toEqual(["0.00 EUR", "1500.00 USD"]);
    expect(d.projects.every((p) => typeof p.currency === "string" && p.currency.length === 3)).toBe(true);
  });

  it("only includes the signed-in freelancer's records", async () => {
    const alice = await createUser();
    const mallory = await createUser();
    await createApprovedProject(alice.id);
    const d = await buildFinancialDataset(mallory.id);
    expect(d.projects).toEqual([]);
    expect(d.facts).toEqual([]);
  });

  it("answers questions from computed facts and records the analysis", async () => {
    const user = await createUser();
    await createApprovedProject(user.id);
    const d = await buildFinancialDataset(user.id);
    const r = await answerFinancialQuestion(user, "What is my outstanding balance?", d.facts);
    expect(r.simulated).toBe(true);
    expect(r.data.answer).toContain("1500.00 USD");
    expect(r.data.citedIds.every((id) => d.facts.some((f) => f.id === id))).toBe(true);
    const row = await db.aIAnalysis.findUniqueOrThrow({ where: { id: r.analysisId } });
    expect(row.kind).toBe("FINANCIAL_INSIGHT");
    await expect(answerFinancialQuestion(user, "?", d.facts)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
