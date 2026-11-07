import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { setPayPalGatewayForTests } from "@/lib/paypal";
import { mockResetPayPal } from "@/lib/paypal/mock-gateway";
import { createProject } from "@/features/projects/service";
import { saveProposal, sendProposal, decideProposal } from "@/features/proposals/service";
import { resolvePortalToken } from "@/features/clients/portal-access";
import { decrypt } from "@/lib/security/tokens";

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  mockResetPayPal();
  setPayPalGatewayForTests(null);
}

export async function createUser(opts: { hourlyRate?: string } = {}) {
  const id = randomUUID();
  const user = await db.user.create({ data: { id, name: "Alex Rivera", email: `${id}@test.local` } });
  await db.freelancerProfile.create({
    data: { userId: id, businessName: "Rivera Studio", hourlyRate: opts.hourlyRate ? new Prisma.Decimal(opts.hourlyRate) : null, onboardedAt: new Date() },
  });
  return { id, name: user.name, email: user.email, profile: { defaultCurrency: "USD", isDemo: false, hourlyRate: opts.hourlyRate ?? null } };
}

export const DEMO_TERMS = {
  title: "Business Landing Page",
  description: "Design and build of a business landing page.",
  currency: "USD",
  budget: "1500.00",
  startDate: null,
  client: { name: "Jordan Lee", email: "jordan@example.com", company: null },
  deliverables: [
    { title: "Landing page design", description: "Single responsive landing page" },
    { title: "Landing page build", description: "Production-ready implementation" },
  ],
  exclusions: ["Booking systems, e-commerce, payments or user account functionality"],
  acceptanceCriteria: ["Responsive on mobile and desktop"],
  milestones: [
    { title: "Upfront deposit", description: "30% deposit", kind: "DEPOSIT", amount: "450.00", dueDate: null },
    { title: "Final delivery", description: "Remaining 70%", kind: "DELIVERY", amount: "1050.00", dueDate: null },
  ],
};

export const PROPOSAL_FIELDS = {
  overview: "Thanks for the opportunity.",
  timelineSummary: "Two weeks.",
  paymentConditions: "Deposit on approval.",
  revisionLimit: 2,
  revisionPolicy: "Two rounds.",
  changeRequestPolicy: "Written change requests.",
  acceptanceStatement: "Accept in the portal.",
};

/** Creates a project, sends the proposal and returns the client portal grant. */
export async function createSentProject(userId: string) {
  const project = await createProject(userId, DEMO_TERMS);
  await saveProposal(userId, project.id, PROPOSAL_FIELDS);
  const version = await sendProposal(userId, project.id);
  const grantRow = await db.clientAccessGrant.findFirstOrThrow({ where: { projectId: project.id } });
  const token = decrypt(grantRow.tokenCiphertext);
  const grant = await resolvePortalToken(token);
  return { project, version, grant, token };
}

export async function createApprovedProject(userId: string) {
  const r = await createSentProject(userId);
  await decideProposal(r.grant, { versionId: r.version.id, termsHash: r.version.termsHash, decision: "APPROVED", actorName: "Jordan Lee", confirm: true }, "vitest");
  const grant = await resolvePortalToken(r.token);
  return { ...r, grant };
}

export async function milestones(projectId: string) {
  return db.milestone.findMany({ where: { projectId }, orderBy: { position: "asc" } });
}
