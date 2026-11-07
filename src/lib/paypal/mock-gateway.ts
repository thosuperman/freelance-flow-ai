import { createHmac, randomUUID } from "node:crypto";
import {
  PayPalApiError,
  type CreateOrderInput,
  type PayPalCapture,
  type PayPalGateway,
  type PayPalOrder,
  type WebhookHeaders,
} from "./types";

/**
 * SIMULATED PayPal used only for automated tests and offline development (PAYPAL_MODE=mock).
 * It mimics Orders v2 semantics (idempotent create, approve → capture, ORDER_ALREADY_CAPTURED, ...).
 * Payments made through it are stored with environment "mock" and always labelled "Simulated" in the UI.
 * It is refused at startup when VERCEL_ENV=production.
 */
type MockOrder = {
  id: string;
  status: PayPalOrder["status"];
  referenceId: string;
  amount: { currency_code: string; value: string };
  captures: PayPalCapture[];
  createdAt: number;
};

type MockState = {
  orders: Map<string, MockOrder>;
  requestIds: Map<string, string>;
  captureRequestIds: Map<string, string>;
  nextCaptureOutcome: "COMPLETED" | "PENDING" | "DECLINED" | null;
};

const g = globalThis as unknown as { __ffMockPayPal?: MockState };
function state(): MockState {
  g.__ffMockPayPal ??= {
    orders: new Map(),
    requestIds: new Map(),
    captureRequestIds: new Map(),
    nextCaptureOutcome: null,
  };
  return g.__ffMockPayPal;
}

export const MOCK_WEBHOOK_SECRET = "mock-webhook-secret";

export function mockWebhookSignature(rawBody: string, transmissionId: string): string {
  return createHmac("sha256", MOCK_WEBHOOK_SECRET).update(`${transmissionId}|${rawBody}`).digest("hex");
}

function toOrder(o: MockOrder): PayPalOrder {
  return {
    id: o.id,
    status: o.status,
    purchase_units: [
      {
        reference_id: o.referenceId,
        custom_id: o.referenceId,
        amount: o.amount,
        payments: o.captures.length ? { captures: o.captures } : undefined,
      },
    ],
    payer: o.status === "APPROVED" || o.status === "COMPLETED" ? { payer_id: "MOCKPAYER01" } : undefined,
  };
}

export class MockPayPalGateway implements PayPalGateway {
  readonly mode = "mock" as const;

  async createOrder(input: CreateOrderInput): Promise<PayPalOrder> {
    const s = state();
    const existing = s.requestIds.get(input.requestId);
    if (existing) return toOrder(s.orders.get(existing)!);
    if (!/^\d+(\.\d{1,2})?$/.test(input.amount.value)) {
      throw new PayPalApiError(422, "DECIMAL_PRECISION", "Invalid amount");
    }
    const id = `MOCK-${randomUUID().replace(/-/g, "").slice(0, 17).toUpperCase()}`;
    const order: MockOrder = {
      id,
      status: "CREATED",
      referenceId: input.referenceId,
      amount: input.amount,
      captures: [],
      createdAt: Date.now(),
    };
    s.orders.set(id, order);
    s.requestIds.set(input.requestId, id);
    return toOrder(order);
  }

  async getOrder(orderId: string): Promise<PayPalOrder> {
    const o = state().orders.get(orderId);
    if (!o) throw new PayPalApiError(404, "RESOURCE_NOT_FOUND", "Order not found");
    return toOrder(o);
  }

  async captureOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
    const s = state();
    const o = s.orders.get(orderId);
    if (!o) throw new PayPalApiError(404, "RESOURCE_NOT_FOUND", "Order not found");
    const prior = s.captureRequestIds.get(requestId);
    if (prior === orderId) return toOrder(o); // idempotent replay
    if (o.status === "COMPLETED") throw new PayPalApiError(422, "ORDER_ALREADY_CAPTURED", "Order already captured");
    if (o.status !== "APPROVED") throw new PayPalApiError(422, "ORDER_NOT_APPROVED", "Payer has not approved the order");
    const outcome = s.nextCaptureOutcome ?? "COMPLETED";
    s.nextCaptureOutcome = null;
    o.captures.push({
      id: `MOCKCAP-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
      status: outcome,
      amount: o.amount,
      custom_id: o.referenceId,
      final_capture: true,
      create_time: new Date().toISOString(),
      supplementary_data: { related_ids: { order_id: o.id } },
    });
    o.status = outcome === "DECLINED" ? "APPROVED" : "COMPLETED";
    s.captureRequestIds.set(requestId, orderId);
    return toOrder(o);
  }

  async verifyWebhookSignature(h: WebhookHeaders, rawBody: string): Promise<boolean> {
    return h.authAlgo === "MOCK-HMAC-SHA256" && h.transmissionSig === mockWebhookSignature(rawBody, h.transmissionId);
  }
}

// ─── Simulated buyer actions & test hooks ───

/** Simulates the buyer approving the order in the PayPal popup. */
export function mockApproveOrder(orderId: string): boolean {
  const o = state().orders.get(orderId);
  if (!o || o.status !== "CREATED") return false;
  o.status = "APPROVED";
  return true;
}

export function mockSetNextCaptureOutcome(outcome: MockState["nextCaptureOutcome"]) {
  state().nextCaptureOutcome = outcome;
}

/** Simulates PayPal completing a PENDING capture later (e.g. after review). */
export function mockCompletePendingCapture(orderId: string): PayPalCapture | null {
  const o = state().orders.get(orderId);
  const cap = o?.captures.find((c) => c.status === "PENDING");
  if (!cap) return null;
  cap.status = "COMPLETED";
  return cap;
}

export function mockResetPayPal() {
  g.__ffMockPayPal = undefined;
}
