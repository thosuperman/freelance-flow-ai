import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/security/tokens";
import { setPayPalGatewayForTests } from "@/lib/paypal";
import { MockPayPalGateway, mockApproveOrder } from "@/lib/paypal/mock-gateway";
import { resolvePortalToken } from "@/features/clients/portal-access";
import { captureCheckoutOrder, createCheckoutOrder } from "@/features/payments/service";
import { getProjectDetail, financialsFor } from "@/features/projects/service";
import { JUDGE_PROJECT_TITLE, seedJudgeWorkspace } from "@/features/demo/judge-seed";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);
afterEach(() => setPayPalGatewayForTests(null));

async function portalGrant(projectId: string) {
  const row = await db.clientAccessGrant.findFirstOrThrow({ where: { projectId, revokedAt: null } });
  return (await resolvePortalToken(decrypt(row.tokenCiphertext)))!;
}

describe("Pre-filled judge demo", () => {
  it("seeds an approved project with a payment-ready deposit and a pending change request", async () => {
    const judge = await createUser({ hourlyRate: "50.00" });
    const seeded = await seedJudgeWorkspace(judge.id);
    const p = await getProjectDetail(judge.id, seeded.projectId);

    expect(p.title).toBe(JUDGE_PROJECT_TITLE);
    expect(p.status).toBe("ACTIVE");
    expect(p.proposal?.versions[0]?.status).toBe("APPROVED");
    const approval = await db.approval.findFirstOrThrow({ where: { projectId: p.id } });
    expect(approval).toMatchObject({ actorName: "Jordan Lee (demo client)", userAgent: "freelanceflow-demo-seed" });

    const pr = p.paymentRequests.find((r) => r.id === seeded.paymentRequestId)!;
    expect(pr).toMatchObject({ status: "OPEN", currency: "USD" });
    expect(pr.amount.toString()).toBe("450");
    expect(p.paymentRequests.flatMap((r) => r.transactions)).toEqual([]); // nothing paid by the seed

    const cr = p.changeRequests.find((c) => c.id === seeded.changeRequestId)!;
    expect(cr).toMatchObject({ status: "PENDING_CLIENT", number: 1 });
    expect(cr.amount.toString()).toBe("300");

    const fin = financialsFor(p);
    expect(fin.originalValue.toString()).toBe("1500");
    expect(fin.paid.toString()).toBe("0");
  });

  it("gives every judge an isolated workspace", async () => {
    const a = await createUser({ hourlyRate: "50.00" });
    const b = await createUser({ hourlyRate: "50.00" });
    const sa = await seedJudgeWorkspace(a.id);
    const sb = await seedJudgeWorkspace(b.id);
    expect(sa.projectId).not.toBe(sb.projectId);
    await expect(getProjectDetail(b.id, sa.projectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProjectDetail(a.id, sb.projectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets two judges pay at the same time without sharing orders or captures", async () => {
    setPayPalGatewayForTests(new MockPayPalGateway());
    const judges = await Promise.all([createUser({ hourlyRate: "50.00" }), createUser({ hourlyRate: "50.00" })]);
    const seeds = await Promise.all(judges.map((j) => seedJudgeWorkspace(j.id)));
    const grants = await Promise.all(seeds.map((s) => portalGrant(s.projectId)));

    const orders = await Promise.all(seeds.map((s, i) => createCheckoutOrder(grants[i]!, s.paymentRequestId)));
    expect(new Set(orders.map((o) => o.orderId)).size).toBe(2);
    orders.forEach((o) => mockApproveOrder(o.orderId));
    const results = await Promise.all(seeds.map((s, i) => captureCheckoutOrder(grants[i]!, s.paymentRequestId, orders[i]!.orderId)));
    expect(results.map((r) => r.status)).toEqual(["PAID", "PAID"]);

    // A judge cannot use another judge's portal grant on their payment request.
    await expect(createCheckoutOrder(grants[0]!, seeds[1]!.paymentRequestId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await db.paymentTransaction.count()).toBe(2);
    const captures = await db.paymentTransaction.findMany({ select: { providerCaptureId: true, paymentRequestId: true } });
    expect(new Set(captures.map((c) => c.providerCaptureId)).size).toBe(2);
    expect(new Set(captures.map((c) => c.paymentRequestId))).toEqual(new Set(seeds.map((s) => s.paymentRequestId)));
  });
});
