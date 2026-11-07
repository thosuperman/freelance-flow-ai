import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setPayPalGatewayForTests, type PayPalGateway, type PayPalOrder } from "@/lib/paypal";
import {
  MockPayPalGateway,
  mockApproveOrder,
  mockCompletePendingCapture,
  mockSetNextCaptureOutcome,
  mockWebhookSignature,
} from "@/lib/paypal/mock-gateway";
import {
  captureCheckoutOrder,
  createCheckoutOrder,
  createPaymentRequest,
  cancelPaymentRequest,
  reconcileAttempt,
} from "@/features/payments/service";
import { handlePayPalWebhook } from "@/features/payments/webhooks";
import { financialsFor, getProjectDetail } from "@/features/projects/service";
import { createApprovedProject, createUser, milestones, resetDb } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const user = await createUser();
  const { project, grant } = await createApprovedProject(user.id);
  const [deposit] = await milestones(project.id);
  const pr = await createPaymentRequest(user.id, { milestoneId: deposit!.id });
  return { user, project, grant, pr, deposit: deposit! };
}

function webhook(event: Record<string, unknown>, opts: { badSignature?: boolean } = {}) {
  const raw = JSON.stringify(event);
  const tid = `t-${Math.random()}`;
  const headers = new Headers({
    "paypal-auth-algo": "MOCK-HMAC-SHA256",
    "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
    "paypal-transmission-id": tid,
    "paypal-transmission-sig": opts.badSignature ? "deadbeef" : mockWebhookSignature(raw, tid),
    "paypal-transmission-time": new Date().toISOString(),
  });
  return handlePayPalWebhook(headers, raw);
}

describe("payment requests", () => {
  it("copies the amount from the approved milestone and allows only one active request", async () => {
    const { user, pr, deposit } = await setup();
    expect(pr.amount.toFixed(2)).toBe("450.00");
    await expect(createPaymentRequest(user.id, { milestoneId: deposit.id })).rejects.toMatchObject({ code: "INVALID_STATE" });
    await cancelPaymentRequest(user.id, pr.id);
    const again = await createPaymentRequest(user.id, { milestoneId: deposit.id });
    expect(again.id).not.toBe(pr.id);
  });

  it("cannot request payment before the proposal is approved", async () => {
    const user = await createUser();
    const { createSentProject } = await import("./helpers");
    const { project } = await createSentProject(user.id);
    const [deposit] = await milestones(project.id);
    await expect(createPaymentRequest(user.id, { milestoneId: deposit!.id })).rejects.toThrow(/approved/);
  });
});

describe("PayPal capture", () => {
  it("creates the order with the server-side amount and records exactly one transaction", async () => {
    const { grant, pr } = await setup();
    let seenAmount: unknown = null;
    const inner = new MockPayPalGateway();
    const spy: PayPalGateway = {
      mode: "mock",
      createOrder: async (i) => {
        seenAmount = i.amount;
        return inner.createOrder(i);
      },
      getOrder: (id) => inner.getOrder(id),
      captureOrder: (id, r) => inner.captureOrder(id, r),
      verifyWebhookSignature: (h, b) => inner.verifyWebhookSignature(h, b),
    };
    setPayPalGatewayForTests(spy);
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    expect(seenAmount).toEqual({ currency_code: "USD", value: "450.00" });
    mockApproveOrder(orderId);
    expect((await captureCheckoutOrder(grant, pr.id, orderId)).status).toBe("PAID");
    // Double click / refresh: no second capture, no duplicate record.
    expect((await captureCheckoutOrder(grant, pr.id, orderId)).status).toBe("ALREADY_PAID");
    expect(await db.paymentTransaction.count()).toBe(1);
    const m = await db.milestone.findUniqueOrThrow({ where: { id: pr.milestoneId } });
    expect(m.paymentStatus).toBe("PAID");
  });

  it("does not mark paid when the buyer has not approved", async () => {
    const { grant, pr } = await setup();
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    await expect(captureCheckoutOrder(grant, pr.id, orderId)).rejects.toThrow(/not been approved/);
    expect((await db.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } })).status).toBe("OPEN");
  });

  it("prevents double payment across two PayPal windows", async () => {
    const { grant, pr } = await setup();
    const a = await createCheckoutOrder(grant, pr.id);
    const b = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(a.orderId);
    mockApproveOrder(b.orderId);
    const results = await Promise.allSettled([captureCheckoutOrder(grant, pr.id, a.orderId), captureCheckoutOrder(grant, pr.id, b.orderId)]);
    const paid = results.filter((r) => r.status === "fulfilled" && r.value.status === "PAID");
    expect(paid).toHaveLength(1);
    expect(await db.paymentTransaction.count({ where: { status: "COMPLETED" } })).toBe(1);
  });

  it("rejects a capture whose amount does not match the payment request", async () => {
    const { grant, pr } = await setup();
    const inner = new MockPayPalGateway();
    const tampering: PayPalGateway = {
      mode: "mock",
      createOrder: (i) => inner.createOrder(i),
      getOrder: (id) => inner.getOrder(id),
      captureOrder: async (id, r) => {
        const o = await inner.captureOrder(id, r);
        const cap = o.purchase_units![0]!.payments!.captures![0]!;
        return { ...o, purchase_units: [{ ...o.purchase_units![0], payments: { captures: [{ ...cap, amount: { currency_code: "USD", value: "1.00" } }] } }] } as PayPalOrder;
      },
      verifyWebhookSignature: (h, b) => inner.verifyWebhookSignature(h, b),
    };
    setPayPalGatewayForTests(tampering);
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(orderId);
    await expect(captureCheckoutOrder(grant, pr.id, orderId)).rejects.toMatchObject({ code: "PAYMENT_VERIFICATION_FAILED" });
    expect((await db.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } })).status).not.toBe("PAID");
    expect(await db.paymentTransaction.count()).toBe(0);
  });

  it("handles PENDING captures and completes them from a verified webhook", async () => {
    const { user, grant, pr, project } = await setup();
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(orderId);
    mockSetNextCaptureOutcome("PENDING");
    expect((await captureCheckoutOrder(grant, pr.id, orderId)).status).toBe("PENDING");
    let fin = financialsFor(await getProjectDetail(user.id, project.id));
    expect(fin.paid.toFixed(2)).toBe("0.00");

    const cap = mockCompletePendingCapture(orderId)!;
    const event = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: cap };
    expect((await webhook(event)).outcome).toBe("processed");
    fin = financialsFor(await getProjectDetail(user.id, project.id));
    expect(fin.paid.toFixed(2)).toBe("450.00");

    // Duplicate delivery of the same event: acknowledged, not reprocessed.
    expect((await webhook(event)).outcome).toBe("duplicate");
    expect(await db.paymentTransaction.count()).toBe(1);
  });

  it("releases the request after a declined capture so the client can retry", async () => {
    const { grant, pr } = await setup();
    const first = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(first.orderId);
    mockSetNextCaptureOutcome("DECLINED");
    expect((await captureCheckoutOrder(grant, pr.id, first.orderId)).status).toBe("DECLINED");
    const second = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(second.orderId);
    expect((await captureCheckoutOrder(grant, pr.id, second.orderId)).status).toBe("PAID");
  });

  it("reconciles after a network timeout during capture", async () => {
    const { grant, pr } = await setup();
    const inner = new MockPayPalGateway();
    let failNext = true;
    const flaky: PayPalGateway = {
      mode: "mock",
      createOrder: (i) => inner.createOrder(i),
      getOrder: (id) => inner.getOrder(id),
      captureOrder: async (id, r) => {
        const result = await inner.captureOrder(id, r); // PayPal captured…
        if (failNext) {
          failNext = false;
          throw new Error("socket hang up"); // …but the response was lost.
        }
        return result;
      },
      verifyWebhookSignature: (h, b) => inner.verifyWebhookSignature(h, b),
    };
    setPayPalGatewayForTests(flaky);
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(orderId);
    await expect(captureCheckoutOrder(grant, pr.id, orderId)).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_ERROR" });
    expect((await db.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } })).status).toBe("OPEN");
    const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { providerOrderId: orderId } });
    const r = await reconcileAttempt(attempt.id);
    expect(r.status).toBe("PAID");
    expect(await db.paymentTransaction.count()).toBe(1);
  });
});

describe("PayPal webhooks", () => {
  it("rejects events with an invalid signature and stores nothing", async () => {
    const r = await webhook({ id: "WH-bad", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }, { badSignature: true });
    expect(r.httpStatus).toBe(400);
    expect(await db.webhookEvent.count()).toBe(0);
  });

  it("captures an approved order when the buyer closed the tab (CHECKOUT.ORDER.APPROVED)", async () => {
    const { grant, pr } = await setup();
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(orderId);
    const r = await webhook({ id: "WH-approved", event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: orderId, status: "APPROVED" } });
    expect(r.outcome).toBe("processed");
    expect((await db.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } })).status).toBe("PAID");
  });

  it("reflects refunds: paid amount drops and the milestone is unpaid again", async () => {
    const { user, grant, pr, project } = await setup();
    const { orderId } = await createCheckoutOrder(grant, pr.id);
    mockApproveOrder(orderId);
    await captureCheckoutOrder(grant, pr.id, orderId);
    const t = await db.paymentTransaction.findFirstOrThrow();
    const refund = {
      id: "WH-refund",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: { id: "REFUND-1", links: [{ rel: "up", href: `https://api.sandbox.paypal.com/v2/payments/captures/${t.providerCaptureId}` }] },
    };
    expect((await webhook(refund)).outcome).toBe("processed");
    const fin = financialsFor(await getProjectDetail(user.id, project.id));
    expect(fin.paid.toFixed(2)).toBe("0.00");
    expect((await db.milestone.findUniqueOrThrow({ where: { id: pr.milestoneId } })).paymentStatus).toBe("UNPAID");
  });

  it("ignores unrelated event types but records them", async () => {
    const r = await webhook({ id: "WH-other", event_type: "BILLING.SUBSCRIPTION.CREATED", resource: { id: "X" } });
    expect(r.outcome).toBe("ignored");
    expect((await db.webhookEvent.findUniqueOrThrow({ where: { eventId: "WH-other" } })).status).toBe("IGNORED");
  });
});
