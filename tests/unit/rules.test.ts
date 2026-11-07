import { describe, expect, it } from "vitest";
import { checkWorkTransition, milestoneStage, paymentEligibility, type MilestoneState } from "@/features/milestones/rules";
import { checkChangeRequestTransition } from "@/features/scope-changes/rules";
import { computeProjectFinancials, milestoneReconciliation } from "@/features/projects/financials";

const base: MilestoneState = {
  kind: "DELIVERY",
  termsStatus: "APPROVED",
  workStatus: "NOT_STARTED",
  paymentStatus: "UNPAID",
  requiresDelivery: true,
};

describe("payment eligibility", () => {
  it("deposit milestones are payable as soon as the proposal is approved", () => {
    expect(paymentEligibility({ ...base, kind: "DEPOSIT", requiresDelivery: false }, "ACTIVE")).toEqual({ eligible: true });
  });
  it("delivery milestones need client acceptance", () => {
    expect(paymentEligibility(base, "ACTIVE")).toMatchObject({ eligible: false });
    expect(paymentEligibility({ ...base, workStatus: "ACCEPTED" }, "ACTIVE")).toEqual({ eligible: true });
  });
  it("draft milestones and unapproved projects are never payable", () => {
    expect(paymentEligibility({ ...base, termsStatus: "DRAFT", workStatus: "ACCEPTED" }, "ACTIVE").eligible).toBe(false);
    expect(paymentEligibility({ ...base, requiresDelivery: false }, "PROPOSED").eligible).toBe(false);
  });
  it("blocks duplicate requests and paid milestones", () => {
    expect(paymentEligibility({ ...base, requiresDelivery: false, paymentStatus: "REQUESTED" }, "ACTIVE").eligible).toBe(false);
    expect(paymentEligibility({ ...base, requiresDelivery: false, paymentStatus: "PAID" }, "ACTIVE").eligible).toBe(false);
  });
});

describe("milestone work transitions", () => {
  it("only the freelancer submits and only the client accepts", () => {
    expect(checkWorkTransition(base, "ACTIVE", "submit", "FREELANCER")).toEqual({ ok: true, to: "SUBMITTED" });
    expect(checkWorkTransition(base, "ACTIVE", "submit", "CLIENT").ok).toBe(false);
    const submitted = { ...base, workStatus: "SUBMITTED" as const };
    expect(checkWorkTransition(submitted, "ACTIVE", "accept", "CLIENT")).toEqual({ ok: true, to: "ACCEPTED" });
    expect(checkWorkTransition(submitted, "ACTIVE", "accept", "FREELANCER").ok).toBe(false);
  });
  it("cannot accept work that was not submitted", () => {
    expect(checkWorkTransition(base, "ACTIVE", "accept", "CLIENT").ok).toBe(false);
  });
  it("cannot work on milestones of unapproved projects", () => {
    expect(checkWorkTransition(base, "PROPOSED", "start", "FREELANCER").ok).toBe(false);
  });
  it("derives a single display stage", () => {
    expect(milestoneStage({ ...base, termsStatus: "DRAFT" })).toBe("Draft");
    expect(milestoneStage({ ...base, workStatus: "ACCEPTED" })).toBe("Client approved");
    expect(milestoneStage({ ...base, workStatus: "ACCEPTED", paymentStatus: "REQUESTED" })).toBe("Payment pending");
    expect(milestoneStage({ ...base, workStatus: "ACCEPTED", paymentStatus: "PAID" })).toBe("Paid");
  });
});

describe("change request transitions", () => {
  it("follows draft → pending → approved and is immutable afterwards", () => {
    expect(checkChangeRequestTransition("DRAFT", "ACTIVE", "send", "FREELANCER")).toEqual({ ok: true, to: "PENDING_CLIENT" });
    expect(checkChangeRequestTransition("PENDING_CLIENT", "ACTIVE", "approve", "CLIENT")).toEqual({ ok: true, to: "APPROVED" });
    expect(checkChangeRequestTransition("APPROVED", "ACTIVE", "edit", "FREELANCER").ok).toBe(false);
    expect(checkChangeRequestTransition("APPROVED", "ACTIVE", "withdraw", "FREELANCER").ok).toBe(false);
  });
  it("freelancers cannot approve on behalf of clients", () => {
    expect(checkChangeRequestTransition("PENDING_CLIENT", "ACTIVE", "approve", "FREELANCER").ok).toBe(false);
  });
  it("drafts cannot be approved directly", () => {
    expect(checkChangeRequestTransition("DRAFT", "ACTIVE", "approve", "CLIENT").ok).toBe(false);
  });
});

describe("project financials", () => {
  it("matches the demo story numbers", () => {
    const f = computeProjectFinancials({
      currency: "USD",
      approvedProposalTotal: "1500.00",
      approvedChangeRequests: [{ amount: "300.00" }],
      completedTransactions: [{ amount: "450.00", currency: "USD" }],
      openPaymentRequests: [{ amount: "300.00", dueDate: new Date(Date.now() + 86_400_000) }],
    });
    expect(f.originalValue.toFixed(2)).toBe("1500.00");
    expect(f.approvedChanges.toFixed(2)).toBe("300.00");
    expect(f.revisedValue.toFixed(2)).toBe("1800.00");
    expect(f.paid.toFixed(2)).toBe("450.00");
    expect(f.outstanding.toFixed(2)).toBe("1350.00");
    expect(f.pendingRequests.toFixed(2)).toBe("300.00");
    expect(f.overdueCount).toBe(0);
  });
  it("detects overdue requests", () => {
    const f = computeProjectFinancials({
      currency: "USD",
      approvedProposalTotal: "100",
      approvedChangeRequests: [],
      completedTransactions: [],
      openPaymentRequests: [{ amount: "40", dueDate: new Date(Date.now() - 1000) }],
    });
    expect(f.overdue.toFixed(2)).toBe("40.00");
  });
  it("refuses to combine currencies", () => {
    expect(() =>
      computeProjectFinancials({
        currency: "USD",
        approvedProposalTotal: "100",
        approvedChangeRequests: [],
        completedTransactions: [{ amount: "10", currency: "EUR" }],
        openPaymentRequests: [],
      }),
    ).toThrow(/currency/);
  });
  it("reconciles milestones against the revised value", () => {
    expect(milestoneReconciliation("1800", ["450", "1050", "300"], "USD").isZero()).toBe(true);
    expect(milestoneReconciliation("1800", ["450", "1050"], "USD").toFixed(2)).toBe("300.00");
  });
});
