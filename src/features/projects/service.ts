import { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { dec, sum, toAmountString } from "@/lib/money";
import { audit } from "@/features/audit/log";
import { assertProjectOwner } from "./access";
import { computeProjectFinancials, milestoneReconciliation } from "./financials";
import { CreateProjectSchema, ProjectTermsSchema, type ProjectTermsInput } from "./schemas";

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Deterministic validation of commercial terms. Returns human-readable problems (empty = OK). */
export function validateTerms(t: ProjectTermsInput): string[] {
  const problems: string[] = [];
  const total = sum(t.milestones.map((m) => m.amount));
  if (!total.equals(dec(t.budget))) {
    problems.push(
      `Milestones add up to ${toAmountString(total, t.currency)} ${t.currency}, but the project value is ${toAmountString(t.budget, t.currency)} ${t.currency}.`,
    );
  }
  if (t.currency === "JPY" && t.milestones.some((m) => m.amount.includes("."))) {
    problems.push("JPY amounts cannot have decimals.");
  }
  if (t.milestones.some((m) => dec(m.amount).lte(0))) problems.push("Every milestone needs an amount greater than zero.");
  if (dec(t.budget).lte(0)) problems.push("The project value must be greater than zero.");
  return problems;
}

async function writeTerms(tx: Tx, projectId: string, t: ProjectTermsInput) {
  await tx.scopeItem.deleteMany({ where: { projectId, origin: "PROPOSAL" } });
  await tx.milestone.deleteMany({ where: { projectId, termsStatus: "DRAFT" } });
  const milestones = [];
  for (const [i, m] of t.milestones.entries()) {
    milestones.push(
      await tx.milestone.create({
        data: {
          projectId,
          position: i + 1,
          kind: m.kind,
          title: m.title,
          description: m.description,
          amount: new Prisma.Decimal(toAmountString(m.amount, t.currency)),
          currency: t.currency,
          dueDate: parseDate(m.dueDate),
          requiresDelivery: m.kind === "DELIVERY",
        },
      }),
    );
  }
  const finalMilestone = milestones.filter((m) => m.kind === "DELIVERY").at(-1);
  await tx.scopeItem.createMany({
    data: [
      ...t.deliverables.map((d, i) => ({
        projectId,
        kind: "DELIVERABLE" as const,
        title: d.title,
        description: d.description,
        position: i + 1,
        milestoneId: finalMilestone?.id ?? null,
      })),
      ...t.exclusions.map((e, i) => ({ projectId, kind: "EXCLUSION" as const, title: e, position: i + 1 })),
    ],
  });
}

export async function createProject(userId: string, raw: unknown) {
  const input = CreateProjectSchema.parse(raw);
  const problems = validateTerms(input);
  if (problems.length) throw new DomainError("INVALID_INPUT", problems.join(" "));

  if (input.analysisId) {
    const analysis = await db.aIAnalysis.findFirst({ where: { id: input.analysisId, ownerId: userId } });
    if (!analysis) throw new DomainError("NOT_FOUND", "AI analysis not found.");
  }

  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { ownerId: userId, name: input.client.name, email: input.client.email ?? null, company: input.client.company ?? null },
    });
    const project = await tx.project.create({
      data: {
        ownerId: userId,
        clientId: client.id,
        title: input.title,
        description: input.description,
        currency: input.currency,
        budget: new Prisma.Decimal(toAmountString(input.budget, input.currency)),
        startDate: parseDate(input.startDate),
        acceptanceCriteria: input.acceptanceCriteria,
        sourceAnalysisId: input.analysisId ?? null,
        aiReview: input.aiReview ?? undefined,
      },
    });
    if (input.analysisId) await tx.aIAnalysis.update({ where: { id: input.analysisId }, data: { projectId: project.id } });
    await writeTerms(tx, project.id, input);
    await audit(tx, {
      projectId: project.id,
      actorType: "FREELANCER",
      actorId: userId,
      action: "project.created",
      data: { fromAI: Boolean(input.analysisId) },
    });
    return project;
  });
}

/** Terms are editable only while the project is a DRAFT (never after a proposal is sent or approved). */
export async function updateProjectTerms(userId: string, projectId: string, raw: unknown) {
  const project = await assertProjectOwner(userId, projectId);
  if (project.status !== "DRAFT") {
    throw new DomainError(
      "INVALID_STATE",
      project.status === "PROPOSED"
        ? "A proposal is awaiting the client's decision. Withdraw it to edit the terms."
        : "Approved terms cannot be edited. Create a change request instead.",
    );
  }
  const input = ProjectTermsSchema.parse(raw);
  const problems = validateTerms(input);
  if (problems.length) throw new DomainError("INVALID_INPUT", problems.join(" "));
  await db.$transaction(async (tx) => {
    // Re-check status inside the transaction to avoid racing with "send proposal".
    const locked = await tx.project.updateMany({
      where: { id: projectId, status: "DRAFT" },
      data: {
        title: input.title,
        description: input.description,
        currency: input.currency,
        budget: new Prisma.Decimal(toAmountString(input.budget, input.currency)),
        startDate: parseDate(input.startDate),
        acceptanceCriteria: input.acceptanceCriteria,
      },
    });
    if (locked.count !== 1) throw new DomainError("INVALID_STATE", "The project terms are locked.");
    await writeTerms(tx, projectId, input);
    await audit(tx, { projectId, actorType: "FREELANCER", actorId: userId, action: "project.terms_updated" });
  });
}

export const projectDetailInclude = {
  client: true,
  scopeItems: { orderBy: [{ kind: "asc" }, { origin: "asc" }, { position: "asc" }] },
  milestones: { orderBy: { position: "asc" } },
  proposal: { include: { versions: { orderBy: { version: "desc" } } } },
  changeRequests: { orderBy: { number: "desc" }, include: { analysis: true } },
  paymentRequests: {
    orderBy: { createdAt: "desc" },
    include: { transactions: true, attempts: { orderBy: { createdAt: "desc" } }, milestone: true },
  },
  accessGrants: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{ include: typeof projectDetailInclude }>;

export async function getProjectDetail(userId: string, projectId: string): Promise<ProjectDetail> {
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: userId }, include: projectDetailInclude });
  if (!project) throw new DomainError("NOT_FOUND", "Project not found.");
  return project;
}

/** Financials from authoritative records only. */
export function financialsFor(project: Pick<ProjectDetail, "currency" | "proposal" | "changeRequests" | "paymentRequests" | "milestones">) {
  const approvedVersion = project.proposal?.versions.find((v) => v.status === "APPROVED") ?? null;
  const fin = computeProjectFinancials({
    currency: project.currency,
    approvedProposalTotal: approvedVersion ? approvedVersion.totalAmount : null,
    approvedChangeRequests: project.changeRequests.filter((c) => c.status === "APPROVED"),
    completedTransactions: project.paymentRequests.flatMap((pr) => pr.transactions.filter((t) => t.status === "COMPLETED")),
    openPaymentRequests: project.paymentRequests.filter((pr) => pr.status === "OPEN" || pr.status === "PROCESSING"),
  });
  const approvedMilestones = project.milestones.filter((m) => m.termsStatus === "APPROVED");
  const reconciliationDiff = fin.hasApprovedAgreement
    ? milestoneReconciliation(fin.revisedValue, approvedMilestones.map((m) => m.amount), project.currency)
    : null;
  return { ...fin, reconciliationDiff };
}

export function termsFromProject(p: ProjectDetail): ProjectTermsInput {
  return {
    title: p.title,
    description: p.description,
    currency: p.currency as ProjectTermsInput["currency"],
    budget: toAmountString(p.budget, p.currency),
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
    deliverables: p.scopeItems
      .filter((s) => s.kind === "DELIVERABLE" && s.origin === "PROPOSAL")
      .map((s) => ({ title: s.title, description: s.description })),
    exclusions: p.scopeItems.filter((s) => s.kind === "EXCLUSION" && s.origin === "PROPOSAL").map((s) => s.title),
    acceptanceCriteria: p.acceptanceCriteria,
    milestones: p.milestones
      .filter((m) => m.kind !== "CHANGE_ORDER")
      .map((m) => ({
        title: m.title,
        description: m.description,
        kind: m.kind === "DEPOSIT" ? "DEPOSIT" : "DELIVERY",
        amount: toAmountString(m.amount, m.currency),
        dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null,
      })),
  };
}
