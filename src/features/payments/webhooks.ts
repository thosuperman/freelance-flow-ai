import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPayPalGateway, type PayPalCapture, type PayPalWebhookEvent, type WebhookHeaders } from "@/lib/paypal";
import { audit } from "@/features/audit/log";
import { reconcileAttempt, recordCapture } from "./service";

export type WebhookResult = { httpStatus: number; outcome: "processed" | "duplicate" | "ignored" | "rejected" | "failed" };

const HANDLED = new Set([
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.PENDING",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.DECLINED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
]);

export function webhookHeadersFrom(h: Headers): WebhookHeaders | null {
  const get = (k: string) => h.get(k) ?? "";
  const w = {
    authAlgo: get("paypal-auth-algo"),
    certUrl: get("paypal-cert-url"),
    transmissionId: get("paypal-transmission-id"),
    transmissionSig: get("paypal-transmission-sig"),
    transmissionTime: get("paypal-transmission-time"),
  };
  return Object.values(w).every(Boolean) ? w : null;
}

/**
 * PayPal webhook processing:
 *  1. Verify the signature with PayPal (verify-webhook-signature). Unverified events are rejected.
 *  2. Store the event keyed by PayPal's event id. A duplicate delivery hits the unique constraint
 *     and is acknowledged without being processed again.
 *  3. Apply the event through the same idempotent recordCapture / reconcile paths as the checkout.
 */
export async function handlePayPalWebhook(headers: Headers, rawBody: string): Promise<WebhookResult> {
  const h = webhookHeadersFrom(headers);
  if (!h) return { httpStatus: 400, outcome: "rejected" };
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return { httpStatus: 400, outcome: "rejected" };
  }
  if (!event?.id || !event.event_type) return { httpStatus: 400, outcome: "rejected" };

  let verified = false;
  try {
    verified = await getPayPalGateway().verifyWebhookSignature(h, rawBody);
  } catch (e) {
    console.error("[paypal] webhook verification call failed", e instanceof Error ? e.message : e);
    return { httpStatus: 503, outcome: "failed" }; // PayPal will retry
  }
  if (!verified) {
    console.warn("[paypal] rejected webhook with invalid signature", { eventType: event.event_type });
    return { httpStatus: 400, outcome: "rejected" };
  }

  const resourceId = typeof event.resource?.id === "string" ? event.resource.id : null;
  try {
    await db.webhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.event_type,
        resourceId,
        verified: true,
        payload: event as unknown as Prisma.InputJsonValue,
        status: HANDLED.has(event.event_type) ? "RECEIVED" : "IGNORED",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const prior = await db.webhookEvent.findUnique({ where: { eventId: event.id } });
      // Only retry events whose previous processing failed.
      if (prior?.status !== "FAILED") return { httpStatus: 200, outcome: "duplicate" };
    } else {
      throw e;
    }
  }
  if (!HANDLED.has(event.event_type)) return { httpStatus: 200, outcome: "ignored" };

  try {
    await applyEvent(event);
    await db.webhookEvent.update({ where: { eventId: event.id }, data: { status: "PROCESSED", processedAt: new Date(), error: null } });
    return { httpStatus: 200, outcome: "processed" };
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 500) : "unknown";
    await db.webhookEvent.update({ where: { eventId: event.id }, data: { status: "FAILED", error: message } });
    console.error("[paypal] webhook processing failed", event.event_type, message);
    // 500 → PayPal retries later; our processing is idempotent.
    return { httpStatus: 500, outcome: "failed" };
  }
}

async function applyEvent(event: PayPalWebhookEvent) {
  const r = event.resource as Record<string, unknown>;
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    const attempt = await db.paymentAttempt.findUnique({ where: { providerOrderId: String(r.id) } });
    if (!attempt) return;
    // The buyer approved the payment; capture it if the browser did not (e.g. closed tab).
    await reconcileAttempt(attempt.id).catch((e) => {
      if (e instanceof Error && e.name === "DomainError") return; // already handled / busy
      throw e;
    });
    return;
  }

  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED" || event.event_type === "PAYMENT.CAPTURE.REVERSED") {
    const captureId = captureIdFromRefund(r) ?? (event.event_type === "PAYMENT.CAPTURE.REVERSED" ? String(r.id) : null);
    if (!captureId) return;
    const t = await db.paymentTransaction.findUnique({ where: { providerCaptureId: captureId }, include: { paymentRequest: true } });
    if (!t || t.status === "REFUNDED") return;
    await db.$transaction(async (tx) => {
      await tx.paymentTransaction.update({ where: { id: t.id }, data: { status: "REFUNDED" } });
      await tx.paymentRequest.update({ where: { id: t.paymentRequestId }, data: { activeKey: null } });
      await tx.milestone.update({ where: { id: t.paymentRequest.milestoneId }, data: { paymentStatus: "UNPAID" } });
      await audit(tx, {
        projectId: t.paymentRequest.projectId,
        actorType: "PAYPAL",
        action: event.event_type === "PAYMENT.CAPTURE.REFUNDED" ? "payment.refunded" : "payment.reversed",
        data: { captureId },
      });
    });
    return;
  }

  // PAYMENT.CAPTURE.* — resource is a capture
  const capture = r as unknown as PayPalCapture;
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  const existing = await db.paymentTransaction.findUnique({ where: { providerCaptureId: capture.id } });
  const attempt = existing
    ? await db.paymentAttempt.findUnique({ where: { id: existing.attemptId } })
    : orderId
      ? await db.paymentAttempt.findUnique({ where: { providerOrderId: orderId } })
      : null;
  if (!attempt) return; // Not one of ours.
  const normalized: PayPalCapture = {
    ...capture,
    status: event.event_type === "PAYMENT.CAPTURE.DENIED" ? "DECLINED" : capture.status,
  };
  await recordCapture(attempt.id, normalized, null, "WEBHOOK", "PAYPAL");
}

function captureIdFromRefund(r: Record<string, unknown>): string | null {
  const links = (r.links as { rel?: string; href?: string }[] | undefined) ?? [];
  const up = links.find((l) => l.rel === "up" && l.href?.includes("/captures/"));
  return up?.href?.split("/captures/")[1]?.split(/[/?]/)[0] ?? null;
}
