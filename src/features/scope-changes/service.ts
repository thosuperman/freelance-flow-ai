import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { toAmountString } from "@/lib/money";
import { hashTerms, safeEqualHex } from "@/lib/security/tokens";
import { audit } from "@/features/audit/log";
import type { PortalGrant } from "@/features/clients/portal-access";
import { assertProjectOwner } from "@/features/projects/access";
import { changeRequestTerms, checkChangeRequestTransition } from "./rules";

export const ChangeRequestInputSchema = z.object({
  title: z.string().trim().min(2, "Add a title").max(200),
  description: z.string().trim().min(1, "Describe the additional work").max(4000),
  requestText: z.string().trim().max(10000).default(""),
  deliverables: z
    .array(z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).default("") }))
    .min(1, "Add at least one deliverable")
    .max(20),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter the additional price, e.g. 300")
    .refine((v) => Number(v) > 0, "The price must be greater than zero"),
  billingTiming: z.enum(["ON_APPROVAL", "ON_DELIVERY"]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  analysisId: z.string().cuid().nullable().optional(),
});
export type ChangeRequestInput = z.infer<typeof ChangeRequestInputSchema>;

export async function createChangeRequest(userId: string, projectId: string, raw: unknown) {
  const project = await assertProjectOwner(userId, projectId);
  if (project.status !== "ACTIVE") throw new DomainError("INVALID_STATE", "Change requests require an approved agreement.");
  const input = ChangeRequestInputSchema.parse(raw);
  if (project.currency === "JPY" && input.amount.includes(".")) throw new DomainError("INVALID_INPUT", "JPY amounts cannot have decimals.");
  if (input.analysisId) {
    const a = await db.aIAnalysis.findFirst({ where: { id: input.analysisId, ownerId: userId, projectId } });
    if (!a) throw new DomainError("NOT_FOUND", "Analysis not found.");
  }
  return db.$transaction(async (tx) => {
    const last = await tx.scopeChangeRequest.findFirst({ where: { projectId }, orderBy: { number: "desc" } });
    const cr = await tx.scopeChangeRequest.create({
      data: {
        projectId,
        number: (last?.number ?? 0) + 1,
        title: input.title,
        description: input.description,
        requestText: input.requestText,
        deliverables: input.deliverables,
        amount: new Prisma.Decimal(toAmountString(input.amount, project.currency)),
        currency: project.currency,
        billingTiming: input.billingTiming,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
        analysisId: input.analysisId ?? null,
      },
    });
    await audit(tx, { projectId, actorType: "FREELANCER", actorId: userId, action: "change_request.created", data: { number: cr.number } });
    return cr;
  });
}

async function loadOwned(userId: string, crId: string) {
  const cr = await db.scopeChangeRequest.findUnique({ where: { id: crId }, include: { project: true } });
  if (!cr || cr.project.ownerId !== userId) throw new DomainError("NOT_FOUND", "Change request not found.");
  return cr;
}

export async function sendChangeRequest(userId: string, crId: string) {
  const cr = await loadOwned(userId, crId);
  const check = checkChangeRequestTransition(cr.status, cr.project.status, "send", "FREELANCER");
  if (!check.ok) throw new DomainError("INVALID_STATE", check.reason);
  const termsHash = hashTerms(changeRequestTerms(cr));
  await db.$transaction(async (tx) => {
    const res = await tx.scopeChangeRequest.updateMany({
      where: { id: cr.id, status: "DRAFT" },
      data: { status: "PENDING_CLIENT", termsHash, sentAt: new Date() },
    });
    if (res.count !== 1) throw new DomainError("CONFLICT", "The change request changed. Please reload.");
    await audit(tx, { projectId: cr.projectId, actorType: "FREELANCER", actorId: userId, action: "change_request.sent", data: { number: cr.number, termsHash } });
  });
}

export async function withdrawChangeRequest(userId: string, crId: string) {
  const cr = await loadOwned(userId, crId);
  const check = checkChangeRequestTransition(cr.status, cr.project.status, "withdraw", "FREELANCER");
  if (!check.ok) throw new DomainError("INVALID_STATE", check.reason);
  await db.$transaction(async (tx) => {
    const res = await tx.scopeChangeRequest.updateMany({
      where: { id: cr.id, status: { in: ["DRAFT", "PENDING_CLIENT"] } },
      data: { status: "WITHDRAWN", decidedAt: new Date() },
    });
    if (res.count !== 1) throw new DomainError("CONFLICT", "The change request was already decided.");
    await audit(tx, { projectId: cr.projectId, actorType: "FREELANCER", actorId: userId, action: "change_request.withdrawn", data: { number: cr.number } });
  });
}

export const ChangeRequestDecisionSchema = z.object({
  changeRequestId: z.string().cuid(),
  termsHash: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["APPROVED", "REJECTED"]),
  actorName: z.string().trim().min(2, "Please type your full name").max(200),
  comment: z.string().trim().max(2000).optional(),
  confirm: z.literal(true).optional(),
});

/**
 * Client approval of a change request. On approval, atomically:
 *  - marks it APPROVED (immutable from then on),
 *  - adds its deliverables to the project scope (origin CHANGE_REQUEST; the original scope is untouched),
 *  - creates an approved CHANGE_ORDER milestone for the agreed amount.
 */
export async function decideChangeRequest(grant: PortalGrant, raw: unknown, userAgent: string | null) {
  const input = ChangeRequestDecisionSchema.parse(raw);
  if (input.decision === "APPROVED" && input.confirm !== true) {
    throw new DomainError("INVALID_INPUT", "Please confirm that you approve this change and its price.");
  }
  return db.$transaction(async (tx) => {
    const cr = await tx.scopeChangeRequest.findUnique({ where: { id: input.changeRequestId }, include: { project: true } });
    if (!cr || cr.projectId !== grant.projectId) throw new DomainError("NOT_FOUND", "Change request not found.");
    const check = checkChangeRequestTransition(cr.status, cr.project.status, input.decision === "APPROVED" ? "approve" : "reject", "CLIENT");
    if (!check.ok) throw new DomainError("INVALID_STATE", check.reason);
    if (!cr.termsHash || !safeEqualHex(cr.termsHash, input.termsHash) || hashTerms(changeRequestTerms(cr)) !== cr.termsHash) {
      throw new DomainError("TERMS_MISMATCH", "This change request changed while you were reviewing it. Please reload.");
    }
    const res = await tx.scopeChangeRequest.updateMany({
      where: { id: cr.id, status: "PENDING_CLIENT" },
      data: { status: check.to, decidedAt: new Date(), clientNote: input.comment ?? null },
    });
    if (res.count !== 1) throw new DomainError("CONFLICT", "This change request was already decided.");

    if (input.decision === "APPROVED") {
      const lastMilestone = await tx.milestone.findFirst({ where: { projectId: cr.projectId }, orderBy: { position: "desc" } });
      const milestone = await tx.milestone.create({
        data: {
          projectId: cr.projectId,
          position: (lastMilestone?.position ?? 0) + 1,
          kind: "CHANGE_ORDER",
          title: `Change request #${cr.number}: ${cr.title}`,
          description: cr.description,
          amount: cr.amount,
          currency: cr.currency,
          dueDate: cr.dueDate,
          termsStatus: "APPROVED",
          requiresDelivery: cr.billingTiming === "ON_DELIVERY",
          changeRequestId: cr.id,
        },
      });
      const deliverables = cr.deliverables as { title: string; description: string }[];
      const lastItem = await tx.scopeItem.findFirst({ where: { projectId: cr.projectId, kind: "DELIVERABLE" }, orderBy: { position: "desc" } });
      await tx.scopeItem.createMany({
        data: deliverables.map((d, i) => ({
          projectId: cr.projectId,
          kind: "DELIVERABLE" as const,
          origin: "CHANGE_REQUEST" as const,
          title: d.title,
          description: d.description,
          position: (lastItem?.position ?? 0) + i + 1,
          milestoneId: milestone.id,
          changeRequestId: cr.id,
        })),
      });
    }

    await tx.approval.create({
      data: {
        projectId: cr.projectId,
        subjectType: "CHANGE_REQUEST",
        subjectId: cr.id,
        decision: input.decision,
        actorType: "CLIENT",
        actorName: input.actorName,
        actorEmail: grant.client.email,
        accessGrantId: grant.id,
        termsHash: cr.termsHash,
        amount: cr.amount,
        currency: cr.currency,
        comment: input.comment ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    });
    await audit(tx, {
      projectId: cr.projectId,
      actorType: "CLIENT",
      actorId: grant.clientId,
      action: input.decision === "APPROVED" ? "change_request.approved" : "change_request.rejected",
      data: { number: cr.number, amount: toAmountString(cr.amount, cr.currency) },
    });
  });
}
