/**
 * Seeds a fictional sample workspace for local development and screenshots.
 *
 *   npm run db:seed
 *
 * Sign in with the test credentials below (local/test only — never use real credentials here).
 * No payments are seeded: every "paid" state in the app must come from a real (or clearly simulated)
 * PayPal capture made through the checkout flow.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { createProject } from "@/features/projects/service";
import { saveProposal, sendProposal, decideProposal } from "@/features/proposals/service";
import { resolvePortalToken } from "@/features/clients/portal-access";
import { createPaymentRequest } from "@/features/payments/service";
import { decrypt } from "@/lib/security/tokens";

export const SEED_EMAIL = "sample@freelanceflow.test";
export const SEED_PASSWORD = "sample-password-2026";

const proposal = {
  overview: "Thank you for the opportunity. This proposal sets out the agreed scope, timeline and payment schedule.",
  timelineSummary: "See milestones.",
  paymentConditions: "Each milestone is paid through PayPal against a payment request.",
  revisionLimit: 2,
  revisionPolicy: "Two rounds of revisions per deliverable are included.",
  changeRequestPolicy: "New requests are handled as written change requests that you approve before work starts.",
  acceptanceStatement: "Review each delivery in your client portal and accept it or request changes.",
};

async function main() {
  const existing = await db.user.findUnique({ where: { email: SEED_EMAIL } });
  if (existing) {
    console.log(`Seed user ${SEED_EMAIL} already exists — skipping.`);
    return;
  }
  const id = randomUUID();
  await db.user.create({ data: { id, name: "Sam Carter", email: SEED_EMAIL, emailVerified: true } });
  await db.account.create({
    data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(SEED_PASSWORD) },
  });
  await db.freelancerProfile.create({
    data: { userId: id, businessName: "Carter Design Co.", defaultCurrency: "USD", hourlyRate: new Prisma.Decimal("65.00"), onboardedAt: new Date() },
  });

  // 1. Active project with an approved proposal and an open deposit request.
  const active = await createProject(id, {
    title: "Bloom Yoga Studio Website",
    description: "Five-page responsive marketing website for a yoga studio.",
    currency: "USD",
    budget: "2400.00",
    startDate: null,
    client: { name: "Maya Chen", email: "maya@bloomyoga.example", company: "Bloom Yoga Studio" },
    deliverables: [
      { title: "Website design", description: "Home, Classes, About, Pricing and Contact pages." },
      { title: "Website build", description: "Responsive implementation with a contact form." },
    ],
    exclusions: ["Online class booking or payments", "Copywriting and photography", "Hosting and domain fees"],
    acceptanceCriteria: ["All five pages work on mobile and desktop"],
    milestones: [
      { title: "Kick-off deposit", description: "50% on approval", kind: "DEPOSIT", amount: "1200.00", dueDate: null },
      { title: "Website launch", description: "50% on acceptance of the live site", kind: "DELIVERY", amount: "1200.00", dueDate: null },
    ],
  });
  await saveProposal(id, active.id, proposal);
  const v = await sendProposal(id, active.id);
  const grantRow = await db.clientAccessGrant.findFirstOrThrow({ where: { projectId: active.id } });
  const grant = await resolvePortalToken(decrypt(grantRow.tokenCiphertext));
  await decideProposal(grant, { versionId: v.id, termsHash: v.termsHash, decision: "APPROVED", actorName: "Maya Chen", confirm: true }, "seed");
  const deposit = await db.milestone.findFirstOrThrow({ where: { projectId: active.id, kind: "DEPOSIT" } });
  await createPaymentRequest(id, { milestoneId: deposit.id });

  // 2. Proposal awaiting the client's decision (EUR, to show currency separation).
  const proposed = await createProject(id, {
    title: "Northwind Brand Refresh",
    description: "Logo refresh and a compact brand guide.",
    currency: "EUR",
    budget: "3000.00",
    startDate: null,
    client: { name: "Daniel Okafor", email: "daniel.okafor@northwind.example", company: "Northwind Coffee Roasters" },
    deliverables: [
      { title: "Logo concepts", description: "Three initial directions." },
      { title: "Brand guide", description: "Colours, typography and usage rules." },
    ],
    exclusions: ["Packaging design", "Printing costs"],
    acceptanceCriteria: [],
    milestones: [
      { title: "Deposit on signing", description: "", kind: "DEPOSIT", amount: "1200.00", dueDate: null },
      { title: "Concept approval", description: "", kind: "DELIVERY", amount: "900.00", dueDate: null },
      { title: "Final files", description: "", kind: "DELIVERY", amount: "900.00", dueDate: null },
    ],
  });
  await saveProposal(id, proposed.id, proposal);
  await sendProposal(id, proposed.id);

  console.log(`Seeded sample workspace. Sign in with ${SEED_EMAIL} / ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
