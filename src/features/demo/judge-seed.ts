import "server-only";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/security/tokens";
import { createProject } from "@/features/projects/service";
import { saveProposal, sendProposal, decideProposal } from "@/features/proposals/service";
import { createPaymentRequest } from "@/features/payments/service";
import { createChangeRequest, sendChangeRequest } from "@/features/scope-changes/service";
import { resolvePortalToken } from "@/features/clients/portal-access";

/**
 * Pre-fills a judge's private demo workspace so the PayPal and scope-change steps are one click away.
 *
 * Everything goes through the normal domain services (validation, immutable proposal version,
 * hashed approval, payment eligibility, change-request rules, audit log). Nothing touches PayPal:
 * the deposit is only *requested* here, and the judge pays it for real in PayPal Sandbox.
 * The client approval is recorded as a demo approval ("Jordan Lee (demo client)", user agent
 * "freelanceflow-demo-seed") so it is distinguishable from approvals made in the portal.
 */
export const JUDGE_PROJECT_TITLE = "Business Landing Page (pre-filled demo)";
const SEED_AGENT = "freelanceflow-demo-seed";

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export async function seedJudgeWorkspace(userId: string) {
  const project = await createProject(userId, {
    title: JUDGE_PROJECT_TITLE,
    description:
      "One responsive landing page for a small consulting business: a first draft for review within seven days and the final page within fourteen. Client supplies text and images.",
    currency: "USD",
    budget: "1500.00",
    startDate: day(0),
    client: { name: "Jordan Lee", email: "jordan@example.com", company: "Lee Consulting" },
    deliverables: [
      { title: "Landing page first draft", description: "Complete first draft of the single landing page, delivered for review." },
      { title: "Final landing page", description: "Finalised, responsive landing page after one round of agreed revisions." },
    ],
    exclusions: [
      "Booking systems, e-commerce, payments or user accounts",
      "Additional pages beyond the single landing page",
      "Copywriting and stock photography",
      "Hosting, domain and ongoing maintenance",
    ],
    acceptanceCriteria: ["Responsive on mobile and desktop", "Loads in under three seconds on a typical connection"],
    milestones: [
      { title: "Upfront deposit", description: "30% deposit, payable when the proposal is approved", kind: "DEPOSIT", amount: "450.00", dueDate: day(0) },
      { title: "Final delivery", description: "Remaining 70%, payable when the final page is accepted", kind: "DELIVERY", amount: "1050.00", dueDate: day(14) },
    ],
  });

  await saveProposal(userId, project.id, {
    overview:
      "Hi Jordan, thanks for the opportunity. I'll design and build one responsive landing page for Lee Consulting: a complete first draft within seven days, then the final page within fourteen days of the start date.",
    timelineSummary: "First draft within 7 days; final landing page within 14 days of the start date.",
    paymentConditions: "A 30% deposit is due when you approve this proposal; the remaining 70% when you accept the final page. Payments are made through PayPal.",
    revisionLimit: 1,
    revisionPolicy: "One round of revisions on the first draft is included.",
    changeRequestPolicy: "Anything outside the approved scope is quoted as a written change request that you approve before work starts.",
    acceptanceStatement: "You approve this exact version in your client portal.",
  });
  const version = await sendProposal(userId, project.id);

  const grantRow = await db.clientAccessGrant.findFirstOrThrow({ where: { projectId: project.id, revokedAt: null } });
  const grant = await resolvePortalToken(decrypt(grantRow.tokenCiphertext));
  if (!grant) throw new Error("Demo seed: portal grant could not be resolved");
  await decideProposal(
    grant,
    { versionId: version.id, termsHash: version.termsHash, decision: "APPROVED", actorName: "Jordan Lee (demo client)", confirm: true },
    SEED_AGENT,
  );

  const deposit = await db.milestone.findFirstOrThrow({ where: { projectId: project.id, kind: "DEPOSIT" } });
  const paymentRequest = await createPaymentRequest(userId, { milestoneId: deposit.id, dueInDays: 7 });

  const user = await db.freelancerProfile.findUniqueOrThrow({ where: { userId } });
  const rate = user.hourlyRate?.toString() ?? "50.00";
  const cr = await createChangeRequest(userId, project.id, {
    title: "Consultation booking system",
    description: "Let visitors book a consultation directly from the landing page, using an embedded scheduling widget.",
    deliverables: [{ title: "Booking widget", description: "Embedded consultation booking form connected to the client's calendar tool" }],
    requestText: "Love the draft! Can you also add a booking system so customers can book a consultation from the page?",
    amount: (Number(rate) * 6).toFixed(2),
    billingTiming: "ON_APPROVAL",
    dueDate: day(17),
  });
  await sendChangeRequest(userId, cr.id);

  return { projectId: project.id, paymentRequestId: paymentRequest.id, changeRequestId: cr.id };
}
