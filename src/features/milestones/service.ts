import { z } from "zod";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { audit } from "@/features/audit/log";
import type { PortalGrant } from "@/features/clients/portal-access";
import { checkWorkTransition, type WorkAction } from "./rules";

async function loadMilestone(milestoneId: string) {
  const m = await db.milestone.findUnique({ where: { id: milestoneId }, include: { project: true } });
  if (!m) throw new DomainError("NOT_FOUND", "Milestone not found.");
  return m;
}

export async function freelancerMilestoneAction(
  userId: string,
  milestoneId: string,
  action: Extract<WorkAction, "start" | "submit">,
  note?: string,
) {
  const m = await loadMilestone(milestoneId);
  if (m.project.ownerId !== userId) throw new DomainError("NOT_FOUND", "Milestone not found.");
  const check = checkWorkTransition(m, m.project.status, action, "FREELANCER");
  if (!check.ok) throw new DomainError("INVALID_STATE", check.reason);
  await db.$transaction(async (tx) => {
    const res = await tx.milestone.updateMany({
      where: { id: m.id, workStatus: m.workStatus },
      data: {
        workStatus: check.to,
        ...(action === "submit" ? { submittedAt: new Date(), submissionNote: note?.trim().slice(0, 4000) || null } : {}),
      },
    });
    if (res.count !== 1) throw new DomainError("CONFLICT", "The milestone changed. Please reload.");
    await audit(tx, { projectId: m.projectId, actorType: "FREELANCER", actorId: userId, action: `milestone.${action}`, data: { milestoneId: m.id } });
  });
}

export const MilestoneReviewSchema = z.object({
  milestoneId: z.string().cuid(),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  actorName: z.string().trim().min(2, "Please type your name").max(200),
  comment: z.string().trim().max(2000).optional(),
});

export async function clientReviewMilestone(grant: PortalGrant, raw: unknown, userAgent: string | null) {
  const input = MilestoneReviewSchema.parse(raw);
  const m = await loadMilestone(input.milestoneId);
  if (m.projectId !== grant.projectId) throw new DomainError("NOT_FOUND", "Milestone not found.");
  if (input.decision === "CHANGES_REQUESTED" && !input.comment) {
    throw new DomainError("INVALID_INPUT", "Please describe what should change.");
  }
  const action: WorkAction = input.decision === "APPROVED" ? "accept" : "request_changes";
  const check = checkWorkTransition(m, m.project.status, action, "CLIENT");
  if (!check.ok) throw new DomainError("INVALID_STATE", check.reason);
  await db.$transaction(async (tx) => {
    const res = await tx.milestone.updateMany({
      where: { id: m.id, workStatus: "SUBMITTED" },
      data: { workStatus: check.to, ...(action === "accept" ? { acceptedAt: new Date() } : {}) },
    });
    if (res.count !== 1) throw new DomainError("CONFLICT", "This milestone was already reviewed.");
    await tx.approval.create({
      data: {
        projectId: m.projectId,
        subjectType: "MILESTONE_DELIVERY",
        subjectId: m.id,
        decision: input.decision,
        actorType: "CLIENT",
        actorName: input.actorName,
        actorEmail: grant.client.email,
        accessGrantId: grant.id,
        amount: m.amount,
        currency: m.currency,
        comment: input.comment ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    });
    await audit(tx, {
      projectId: m.projectId,
      actorType: "CLIENT",
      actorId: grant.clientId,
      action: action === "accept" ? "milestone.accepted" : "milestone.changes_requested",
      data: { milestoneId: m.id },
    });
  });
}
