import type { ChangeRequestStatus, ProjectStatus } from "@prisma/client";
import { toAmountString } from "@/lib/money";

/**
 * Change request lifecycle:
 *   DRAFT ──send──▶ PENDING_CLIENT ──approve──▶ APPROVED (immutable; creates scope + milestone)
 *     │                  ├──reject──▶ REJECTED
 *     └──discard          └──withdraw─▶ WITHDRAWN
 * Only DRAFT change requests may be edited. Approval is a client-only action.
 */
export type ChangeRequestAction = "edit" | "send" | "withdraw" | "approve" | "reject";
type Actor = "FREELANCER" | "CLIENT";

const RULES: Record<ChangeRequestAction, { actor: Actor; from: ChangeRequestStatus[]; to: ChangeRequestStatus }> = {
  edit: { actor: "FREELANCER", from: ["DRAFT"], to: "DRAFT" },
  send: { actor: "FREELANCER", from: ["DRAFT"], to: "PENDING_CLIENT" },
  withdraw: { actor: "FREELANCER", from: ["DRAFT", "PENDING_CLIENT"], to: "WITHDRAWN" },
  approve: { actor: "CLIENT", from: ["PENDING_CLIENT"], to: "APPROVED" },
  reject: { actor: "CLIENT", from: ["PENDING_CLIENT"], to: "REJECTED" },
};

export function checkChangeRequestTransition(
  status: ChangeRequestStatus,
  projectStatus: ProjectStatus,
  action: ChangeRequestAction,
  actor: Actor,
): { ok: true; to: ChangeRequestStatus } | { ok: false; reason: string } {
  const rule = RULES[action];
  if (rule.actor !== actor) return { ok: false, reason: `Only the ${rule.actor.toLowerCase()} can ${action} a change request.` };
  if (projectStatus !== "ACTIVE") {
    return { ok: false, reason: "Change requests apply only to projects with an approved agreement." };
  }
  if (!rule.from.includes(status)) {
    return { ok: false, reason: `A ${status.toLowerCase().replace("_", " ")} change request cannot be ${pastTense(action)}.` };
  }
  return { ok: true, to: rule.to };
}

function pastTense(a: ChangeRequestAction): string {
  return { edit: "edited", send: "sent", withdraw: "withdrawn", approve: "approved", reject: "rejected" }[a];
}

/** The commercial terms a client approves. Hashed when sent; approval must quote the same hash. */
export function changeRequestTerms(cr: {
  id: string;
  number: number;
  title: string;
  description: string;
  deliverables: unknown;
  amount: { toString(): string };
  currency: string;
  billingTiming: string;
  dueDate: Date | null;
}) {
  return {
    id: cr.id,
    number: cr.number,
    title: cr.title,
    description: cr.description,
    deliverables: cr.deliverables,
    amount: toAmountString(cr.amount, cr.currency),
    currency: cr.currency,
    billingTiming: cr.billingTiming,
    dueDate: cr.dueDate ? cr.dueDate.toISOString() : null,
  };
}
