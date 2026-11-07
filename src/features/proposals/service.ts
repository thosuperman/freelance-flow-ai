import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { sum, toAmountString } from "@/lib/money";
import { hashTerms, safeEqualHex } from "@/lib/security/tokens";
import { audit } from "@/features/audit/log";
import { ensureAccessGrant, type PortalGrant } from "@/features/clients/portal-access";
import { assertProjectOwner } from "@/features/projects/access";
import { validateTerms, termsFromProject, projectDetailInclude, type ProjectDetail } from "@/features/projects/service";

export const ProposalFieldsSchema = z.object({
  overview: z.string().trim().min(1, "Overview is required").max(5000),
  timelineSummary: z.string().trim().max(3000).default(""),
  paymentConditions: z.string().trim().max(3000).default(""),
  revisionLimit: z.coerce.number().int().min(0).max(20),
  revisionPolicy: z.string().trim().max(3000).default(""),
  changeRequestPolicy: z.string().trim().max(3000).default(""),
  acceptanceStatement: z.string().trim().max(3000).default(""),
});
export type ProposalFields = z.infer<typeof ProposalFieldsSchema>;

export async function saveProposal(userId: string, projectId: string, raw: unknown, aiGenerated = false) {
  const project = await assertProjectOwner(userId, projectId);
  if (project.status !== "DRAFT") {
    throw new DomainError("INVALID_STATE", "The proposal can only be edited while the project is a draft.");
  }
  const f = ProposalFieldsSchema.parse(raw);
  return db.proposal.upsert({
    where: { projectId },
    create: { projectId, ...f, aiGenerated },
    update: { ...f, ...(aiGenerated ? { aiGenerated: true } : {}) },
  });
}

/**
 * The snapshot is exactly what the client sees and approves. It is stored immutably on the
 * ProposalVersion and its SHA-256 (termsHash) must be quoted back on approval.
 */
export function buildProposalSnapshot(
  p: ProjectDetail,
  version: number,
  freelancer: { name: string; businessName: string | null },
) {
  if (!p.proposal) throw new DomainError("INVALID_STATE", "Write the proposal before sending it.");
  const milestones = p.milestones.filter((m) => m.kind !== "CHANGE_ORDER");
  return {
    schema: 1,
    projectId: p.id,
    version,
    title: p.title,
    description: p.description,
    currency: p.currency,
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
    client: { name: p.client.name, email: p.client.email, company: p.client.company },
    freelancer: { name: freelancer.name, businessName: freelancer.businessName },
    deliverables: p.scopeItems
      .filter((s) => s.kind === "DELIVERABLE" && s.origin === "PROPOSAL")
      .map((s) => ({ id: s.id, title: s.title, description: s.description })),
    exclusions: p.scopeItems.filter((s) => s.kind === "EXCLUSION" && s.origin === "PROPOSAL").map((s) => ({ id: s.id, title: s.title })),
    acceptanceCriteria: p.acceptanceCriteria,
    milestones: milestones.map((m) => ({
      id: m.id,
      position: m.position,
      kind: m.kind,
      title: m.title,
      description: m.description,
      amount: toAmountString(m.amount, m.currency),
      dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null,
    })),
    total: toAmountString(sum(milestones.map((m) => m.amount)), p.currency),
    terms: {
      overview: p.proposal.overview,
      timelineSummary: p.proposal.timelineSummary,
      paymentConditions: p.proposal.paymentConditions,
      revisionLimit: p.proposal.revisionLimit,
      revisionPolicy: p.proposal.revisionPolicy,
      changeRequestPolicy: p.proposal.changeRequestPolicy,
      acceptanceStatement: p.proposal.acceptanceStatement,
    },
  };
}
export type ProposalSnapshot = ReturnType<typeof buildProposalSnapshot>;

async function loadForSnapshot(tx: Tx, projectId: string) {
  const p = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { ...projectDetailInclude, owner: { include: { profile: true } } },
  });
  return p;
}

export async function sendProposal(userId: string, projectId: string) {
  const project = await assertProjectOwner(userId, projectId);
  if (project.status !== "DRAFT") throw new DomainError("INVALID_STATE", "This proposal has already been sent.");

  return db.$transaction(async (tx) => {
    const p = await loadForSnapshot(tx, projectId);
    if (!p.proposal) throw new DomainError("INVALID_STATE", "Write the proposal before sending it.");
    const problems = validateTerms(termsFromProject(p));
    if (problems.length) throw new DomainError("INVALID_INPUT", problems.join(" "));

    const last = await tx.proposalVersion.findFirst({ where: { proposalId: p.proposal.id }, orderBy: { version: "desc" } });
    const version = (last?.version ?? 0) + 1;
    const snapshot = buildProposalSnapshot(p, version, { name: p.owner.name, businessName: p.owner.profile?.businessName ?? null });
    const locked = await tx.project.updateMany({ where: { id: projectId, status: "DRAFT" }, data: { status: "PROPOSED" } });
    if (locked.count !== 1) throw new DomainError("CONFLICT", "The project changed. Please reload.");

    const v = await tx.proposalVersion.create({
      data: {
        proposalId: p.proposal.id,
        version,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        termsHash: hashTerms(snapshot),
        totalAmount: new Prisma.Decimal(snapshot.total),
        currency: p.currency,
      },
    });
    await ensureAccessGrant(tx, projectId, p.clientId);
    await audit(tx, {
      projectId,
      actorType: "FREELANCER",
      actorId: userId,
      action: "proposal.sent",
      data: { version, termsHash: v.termsHash, total: snapshot.total },
    });
    return v;
  });
}

export async function withdrawProposal(userId: string, projectId: string) {
  await assertProjectOwner(userId, projectId);
  await db.$transaction(async (tx) => {
    const proposal = await tx.proposal.findUnique({ where: { projectId } });
    if (!proposal) throw new DomainError("NOT_FOUND", "No proposal.");
    const res = await tx.proposalVersion.updateMany({
      where: { proposalId: proposal.id, status: "PENDING" },
      data: { status: "WITHDRAWN", decidedAt: new Date() },
    });
    if (res.count === 0) throw new DomainError("INVALID_STATE", "There is no pending proposal to withdraw.");
    await tx.project.updateMany({ where: { id: projectId, status: "PROPOSED" }, data: { status: "DRAFT" } });
    await audit(tx, { projectId, actorType: "FREELANCER", actorId: userId, action: "proposal.withdrawn" });
  });
}

export const ProposalDecisionSchema = z.object({
  versionId: z.string().cuid(),
  termsHash: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  actorName: z.string().trim().min(2, "Please type your full name").max(200),
  comment: z.string().trim().max(2000).optional(),
  confirm: z.literal(true).optional(),
});

/**
 * Client decision on a specific, immutable proposal version. Approval requires:
 *  - the version belongs to the portal grant's project and is the current PENDING version,
 *  - the quoted termsHash matches the stored hash,
 *  - the stored snapshot still hashes to that value (integrity),
 *  - the live project terms still produce the same snapshot (terms were locked while pending).
 */
export async function decideProposal(grant: PortalGrant, raw: unknown, userAgent: string | null) {
  const input = ProposalDecisionSchema.parse(raw);
  if (input.decision === "APPROVED" && input.confirm !== true) {
    throw new DomainError("INVALID_INPUT", "Please confirm that you approve these terms.");
  }
  return db.$transaction(async (tx) => {
    const v = await tx.proposalVersion.findUnique({ where: { id: input.versionId }, include: { proposal: true } });
    if (!v || v.proposal.projectId !== grant.projectId) throw new DomainError("NOT_FOUND", "Proposal not found.");
    if (v.status !== "PENDING") throw new DomainError("INVALID_STATE", "This proposal version is no longer awaiting a decision.");
    if (!safeEqualHex(v.termsHash, input.termsHash)) {
      throw new DomainError("TERMS_MISMATCH", "The proposal changed while you were reviewing it. Please reload.");
    }
    if (hashTerms(v.snapshot) !== v.termsHash) {
      throw new DomainError("TERMS_MISMATCH", "Proposal integrity check failed.");
    }
    const snapshot = v.snapshot as unknown as ProposalSnapshot;

    if (input.decision === "APPROVED") {
      const p = await loadForSnapshot(tx, grant.projectId);
      const live = buildProposalSnapshot(p, v.version, { name: snapshot.freelancer.name, businessName: snapshot.freelancer.businessName });
      if (hashTerms(live) !== v.termsHash) {
        throw new DomainError("TERMS_MISMATCH", "The project terms no longer match this proposal. Ask the freelancer to resend it.");
      }
    }

    const updated = await tx.proposalVersion.updateMany({
      where: { id: v.id, status: "PENDING" },
      data: {
        status: input.decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED",
        decidedAt: new Date(),
        clientNote: input.comment ?? null,
      },
    });
    if (updated.count !== 1) throw new DomainError("CONFLICT", "This proposal was already decided.");

    if (input.decision === "APPROVED") {
      await tx.project.update({ where: { id: grant.projectId }, data: { status: "ACTIVE" } });
      const milestoneIds = snapshot.milestones.map((m) => m.id);
      const approved = await tx.milestone.updateMany({
        where: { id: { in: milestoneIds }, projectId: grant.projectId, termsStatus: "DRAFT" },
        data: { termsStatus: "APPROVED" },
      });
      if (approved.count !== milestoneIds.length) throw new DomainError("CONFLICT", "Milestones changed. Please reload.");
    } else {
      await tx.project.update({ where: { id: grant.projectId }, data: { status: "DRAFT" } });
    }

    await tx.approval.create({
      data: {
        projectId: grant.projectId,
        subjectType: "PROPOSAL_VERSION",
        subjectId: v.id,
        decision: input.decision,
        actorType: "CLIENT",
        actorName: input.actorName,
        actorEmail: grant.client.email,
        accessGrantId: grant.id,
        termsHash: v.termsHash,
        amount: v.totalAmount,
        currency: v.currency,
        comment: input.comment ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    });
    await audit(tx, {
      projectId: grant.projectId,
      actorType: "CLIENT",
      actorId: grant.clientId,
      action: input.decision === "APPROVED" ? "proposal.approved" : "proposal.revision_requested",
      data: { version: v.version, termsHash: v.termsHash },
    });
    return { status: input.decision };
  });
}
