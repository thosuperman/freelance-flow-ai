import type {
  MilestoneKind,
  MilestonePaymentStatus,
  ProjectStatus,
  TermsStatus,
  WorkStatus,
} from "@prisma/client";

/**
 * Pure, deterministic milestone rules. These — not AI output — decide what is allowed.
 * Work status and payment status are separate state machines so they can never contradict.
 */

export type MilestoneState = {
  kind: MilestoneKind;
  termsStatus: TermsStatus;
  workStatus: WorkStatus;
  paymentStatus: MilestonePaymentStatus;
  requiresDelivery: boolean;
};

export type WorkAction = "start" | "submit" | "accept" | "request_changes";
export type Actor = "FREELANCER" | "CLIENT";

const WORK_TRANSITIONS: Record<WorkAction, { actor: Actor; from: WorkStatus[]; to: WorkStatus }> = {
  start: { actor: "FREELANCER", from: ["NOT_STARTED", "CHANGES_REQUESTED"], to: "IN_PROGRESS" },
  submit: {
    actor: "FREELANCER",
    from: ["NOT_STARTED", "IN_PROGRESS", "CHANGES_REQUESTED"],
    to: "SUBMITTED",
  },
  accept: { actor: "CLIENT", from: ["SUBMITTED"], to: "ACCEPTED" },
  request_changes: { actor: "CLIENT", from: ["SUBMITTED"], to: "CHANGES_REQUESTED" },
};

export type TransitionCheck = { ok: true; to: WorkStatus } | { ok: false; reason: string };

export function checkWorkTransition(
  m: MilestoneState,
  projectStatus: ProjectStatus,
  action: WorkAction,
  actor: Actor,
): TransitionCheck {
  const t = WORK_TRANSITIONS[action];
  if (t.actor !== actor) return { ok: false, reason: `Only the ${t.actor.toLowerCase()} can do this.` };
  if (projectStatus !== "ACTIVE") return { ok: false, reason: "The project is not active." };
  if (m.termsStatus !== "APPROVED") {
    return { ok: false, reason: "This milestone is not part of an approved agreement yet." };
  }
  if (!m.requiresDelivery) {
    return { ok: false, reason: "This milestone does not require a delivery." };
  }
  if (!t.from.includes(m.workStatus)) {
    return { ok: false, reason: `Cannot ${action.replace("_", " ")} a milestone that is ${humanWorkStatus(m.workStatus)}.` };
  }
  return { ok: true, to: t.to };
}

export type Eligibility = { eligible: true } | { eligible: false; reason: string };

/** Whether the freelancer may issue a payment request for this milestone right now. */
export function paymentEligibility(m: MilestoneState, projectStatus: ProjectStatus): Eligibility {
  if (projectStatus !== "ACTIVE" && projectStatus !== "COMPLETED") {
    return { eligible: false, reason: "The proposal must be approved before requesting payment." };
  }
  if (m.termsStatus !== "APPROVED") {
    return { eligible: false, reason: "Only approved milestones can be billed." };
  }
  if (m.paymentStatus === "PAID") return { eligible: false, reason: "Already paid." };
  if (m.paymentStatus === "REQUESTED" || m.paymentStatus === "PROCESSING") {
    return { eligible: false, reason: "A payment request is already open." };
  }
  if (m.requiresDelivery && m.workStatus !== "ACCEPTED") {
    return { eligible: false, reason: "The client must accept the delivered work first." };
  }
  return { eligible: true };
}

export function humanWorkStatus(s: WorkStatus): string {
  switch (s) {
    case "NOT_STARTED":
      return "not started";
    case "IN_PROGRESS":
      return "in progress";
    case "SUBMITTED":
      return "submitted for review";
    case "CHANGES_REQUESTED":
      return "awaiting changes";
    case "ACCEPTED":
      return "accepted";
  }
}

/** Compact lifecycle stage used for display: Draft → Approved → In progress → Submitted → Client approved → Payment pending → Paid */
export type MilestoneStage =
  | "Draft"
  | "Approved"
  | "In progress"
  | "Submitted"
  | "Changes requested"
  | "Client approved"
  | "Payment pending"
  | "Paid";

export function milestoneStage(m: MilestoneState): MilestoneStage {
  if (m.termsStatus === "DRAFT") return "Draft";
  if (m.paymentStatus === "PAID") return "Paid";
  if (m.paymentStatus === "REQUESTED" || m.paymentStatus === "PROCESSING") return "Payment pending";
  if (!m.requiresDelivery) return "Approved";
  switch (m.workStatus) {
    case "NOT_STARTED":
      return "Approved";
    case "IN_PROGRESS":
      return "In progress";
    case "SUBMITTED":
      return "Submitted";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "ACCEPTED":
      return "Client approved";
  }
}
