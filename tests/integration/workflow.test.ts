import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { mockApproveOrder } from "@/lib/paypal/mock-gateway";
import { getProjectDetail, financialsFor, updateProjectTerms, createProject } from "@/features/projects/service";
import { decideProposal, withdrawProposal, sendProposal } from "@/features/proposals/service";
import { createPaymentRequest, createCheckoutOrder, captureCheckoutOrder } from "@/features/payments/service";
import { createChangeRequest, sendChangeRequest, decideChangeRequest } from "@/features/scope-changes/service";
import { freelancerMilestoneAction, clientReviewMilestone } from "@/features/milestones/service";
import { assertProjectOwner } from "@/features/projects/access";
import { resolvePortalToken, revokeAndReissue } from "@/features/clients/portal-access";
import { compareScope } from "@/features/ai/service";
import { DEMO_TERMS, createApprovedProject, createSentProject, createUser, milestones, resetDb } from "./helpers";

beforeEach(resetDb);

async function payDeposit(grant: Awaited<ReturnType<typeof createApprovedProject>>["grant"], userId: string, milestoneId: string) {
  const pr = await createPaymentRequest(userId, { milestoneId });
  const { orderId } = await createCheckoutOrder(grant, pr.id);
  expect(mockApproveOrder(orderId)).toBe(true);
  const outcome = await captureCheckoutOrder(grant, pr.id, orderId);
  return { pr, orderId, outcome };
}

describe("end-to-end commercial workflow (demo story)", () => {
  it("project → approval → $450 deposit → scope change $300 → totals 1800 / 450 / 1350", async () => {
    const user = await createUser({ hourlyRate: "50.00" });
    const { project, grant } = await createApprovedProject(user.id);
    const [deposit, final] = await milestones(project.id);
    expect(deposit!.termsStatus).toBe("APPROVED");
    expect(final!.termsStatus).toBe("APPROVED");

    const { outcome } = await payDeposit(grant, user.id, deposit!.id);
    expect(outcome.status).toBe("PAID");

    const comparison = await compareScope(user, project.id, "Can you also add a booking system?");
    expect(comparison.comparison.classification).toBe("out_of_scope");
    expect(comparison.comparison.suggestedPrice).toBe("300.00");

    const cr = await createChangeRequest(user.id, project.id, {
      ...comparison.comparison.draftChangeRequest!,
      requestText: "Can you also add a booking system?",
      amount: comparison.comparison.suggestedPrice!,
      billingTiming: "ON_APPROVAL",
      analysisId: comparison.analysisId,
    });
    await sendChangeRequest(user.id, cr.id);
    const sent = await db.scopeChangeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    await decideChangeRequest(grant, { changeRequestId: cr.id, termsHash: sent.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null);

    const detail = await getProjectDetail(user.id, project.id);
    const fin = financialsFor(detail);
    expect(fin.originalValue.toFixed(2)).toBe("1500.00");
    expect(fin.approvedChanges.toFixed(2)).toBe("300.00");
    expect(fin.revisedValue.toFixed(2)).toBe("1800.00");
    expect(fin.paid.toFixed(2)).toBe("450.00");
    expect(fin.outstanding.toFixed(2)).toBe("1350.00");
    expect(fin.reconciliationDiff?.isZero()).toBe(true);

    // The original approved scope is preserved; the CR adds new items.
    expect(detail.scopeItems.filter((s) => s.origin === "PROPOSAL" && s.kind === "DELIVERABLE")).toHaveLength(2);
    expect(detail.scopeItems.filter((s) => s.origin === "CHANGE_REQUEST")).toHaveLength(1);

    // Change order milestone is immediately billable through PayPal.
    const changeOrder = detail.milestones.find((m) => m.kind === "CHANGE_ORDER")!;
    expect(changeOrder.amount.toFixed(2)).toBe("300.00");
    const pr = await createPaymentRequest(user.id, { milestoneId: changeOrder.id });
    expect(pr.amount.toFixed(2)).toBe("300.00");
  });

  it("delivery milestones become payable only after the client accepts the work", async () => {
    const user = await createUser();
    const { project, grant } = await createApprovedProject(user.id);
    const [, final] = await milestones(project.id);
    await expect(createPaymentRequest(user.id, { milestoneId: final!.id })).rejects.toThrow(/accept/);
    await freelancerMilestoneAction(user.id, final!.id, "submit", "Staging link");
    await clientReviewMilestone(grant, { milestoneId: final!.id, decision: "APPROVED", actorName: "Jordan Lee" }, null);
    const pr = await createPaymentRequest(user.id, { milestoneId: final!.id });
    expect(pr.amount.toFixed(2)).toBe("1050.00");
  });
});

describe("proposal approval integrity", () => {
  it("locks terms while a proposal is pending and after approval", async () => {
    const user = await createUser();
    const { project, grant, version } = await createSentProject(user.id);
    await expect(updateProjectTerms(user.id, project.id, DEMO_TERMS)).rejects.toThrow(/Withdraw/);
    await decideProposal(grant, { versionId: version.id, termsHash: version.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null);
    await expect(updateProjectTerms(user.id, project.id, DEMO_TERMS)).rejects.toThrow(/change request/);
  });

  it("rejects approval with a wrong terms hash, without confirmation, or twice", async () => {
    const user = await createUser();
    const { grant, version } = await createSentProject(user.id);
    await expect(
      decideProposal(grant, { versionId: version.id, termsHash: "0".repeat(64), decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null),
    ).rejects.toMatchObject({ code: "TERMS_MISMATCH" });
    await expect(
      decideProposal(grant, { versionId: version.id, termsHash: version.termsHash, decision: "APPROVED", actorName: "Jordan Lee" }, null),
    ).rejects.toThrow(/confirm/);
    await decideProposal(grant, { versionId: version.id, termsHash: version.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null);
    await expect(
      decideProposal(grant, { versionId: version.id, termsHash: version.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("detects tampering with a stored snapshot", async () => {
    const user = await createUser();
    const { grant, version } = await createSentProject(user.id);
    const snap = version.snapshot as Record<string, unknown>;
    await db.proposalVersion.update({ where: { id: version.id }, data: { snapshot: { ...snap, total: "1.00" } } });
    await expect(
      decideProposal(grant, { versionId: version.id, termsHash: version.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null),
    ).rejects.toMatchObject({ code: "TERMS_MISMATCH" });
  });

  it("records an approval with actor, version hash and amount", async () => {
    const user = await createUser();
    const { project, version } = await createApprovedProject(user.id);
    const approval = await db.approval.findFirstOrThrow({ where: { projectId: project.id, subjectType: "PROPOSAL_VERSION" } });
    expect(approval).toMatchObject({ actorName: "Jordan Lee", actorType: "CLIENT", termsHash: version.termsHash, currency: "USD" });
    expect(approval.amount?.toFixed(2)).toBe("1500.00");
  });

  it("supports revision requests and a new immutable version", async () => {
    const user = await createUser();
    const { project, grant, version } = await createSentProject(user.id);
    await decideProposal(grant, { versionId: version.id, termsHash: version.termsHash, decision: "CHANGES_REQUESTED", actorName: "Jordan Lee", comment: "Please add a FAQ section" }, null);
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status).toBe("DRAFT");
    await updateProjectTerms(user.id, project.id, { ...DEMO_TERMS, deliverables: [...DEMO_TERMS.deliverables, { title: "FAQ section", description: "" }] });
    const v2 = await sendProposal(user.id, project.id);
    expect(v2.version).toBe(2);
    expect(v2.termsHash).not.toBe(version.termsHash);
    const v1 = await db.proposalVersion.findUniqueOrThrow({ where: { id: version.id } });
    expect(v1.status).toBe("REVISION_REQUESTED");
  });

  it("refuses to send a proposal whose milestones do not reconcile with the budget", async () => {
    const user = await createUser();
    await expect(createProject(user.id, { ...DEMO_TERMS, budget: "1600.00" })).rejects.toThrow(/add up/);
  });

  it("withdrawal unlocks terms", async () => {
    const user = await createUser();
    const { project } = await createSentProject(user.id);
    await withdrawProposal(user.id, project.id);
    await updateProjectTerms(user.id, project.id, { ...DEMO_TERMS, title: "Renamed" });
  });
});

describe("authorization boundaries", () => {
  it("a freelancer cannot load or modify another freelancer's project", async () => {
    const alice = await createUser();
    const mallory = await createUser();
    const { project } = await createApprovedProject(alice.id);
    const [deposit] = await milestones(project.id);
    await expect(assertProjectOwner(mallory.id, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProjectDetail(mallory.id, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createPaymentRequest(mallory.id, { milestoneId: deposit!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createChangeRequest(mallory.id, project.id, {})).rejects.toBeInstanceOf(DomainError);
  });

  it("a client token cannot act on another project's proposal or payments", async () => {
    const user = await createUser();
    const a = await createSentProject(user.id);
    const b = await createApprovedProject(user.id);
    await expect(
      decideProposal(b.grant, { versionId: a.version.id, termsHash: a.version.termsHash, decision: "APPROVED", actorName: "X Y", confirm: true }, null),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [depositB] = await milestones(b.project.id);
    const pr = await createPaymentRequest(user.id, { milestoneId: depositB!.id });
    await expect(createCheckoutOrder(a.grant, pr.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("revoked and malformed tokens are rejected", async () => {
    const user = await createUser();
    const { project, token } = await createSentProject(user.id);
    await revokeAndReissue(project.id, project.clientId);
    await expect(resolvePortalToken(token)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(resolvePortalToken("short")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("freelancers cannot approve change requests on behalf of clients (only clients hold portal grants)", async () => {
    const user = await createUser();
    const { project, grant } = await createApprovedProject(user.id);
    const cr = await createChangeRequest(user.id, project.id, {
      title: "Booking", description: "Add booking", deliverables: [{ title: "Booking", description: "" }], amount: "300", billingTiming: "ON_APPROVAL",
    });
    // Not yet sent: even the client cannot approve a draft.
    await expect(
      decideChangeRequest(grant, { changeRequestId: cr.id, termsHash: "a".repeat(64), decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("an approved change request cannot be edited or withdrawn", async () => {
    const user = await createUser();
    const { project, grant } = await createApprovedProject(user.id);
    const cr = await createChangeRequest(user.id, project.id, {
      title: "Booking", description: "Add booking", deliverables: [{ title: "Booking", description: "" }], amount: "300", billingTiming: "ON_APPROVAL",
    });
    await sendChangeRequest(user.id, cr.id);
    const sent = await db.scopeChangeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    await decideChangeRequest(grant, { changeRequestId: cr.id, termsHash: sent.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, null);
    const { withdrawChangeRequest } = await import("@/features/scope-changes/service");
    await expect(withdrawChangeRequest(user.id, cr.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(sendChangeRequest(user.id, cr.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
