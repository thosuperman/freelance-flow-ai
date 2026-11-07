import { Prisma, type PaymentAttempt, type PaymentRequest } from "@prisma/client";
import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { toPayPalValue } from "@/lib/money";
import { getPayPalGateway, PayPalApiError, type PayPalCapture, type PayPalOrder } from "@/lib/paypal";
import { audit } from "@/features/audit/log";
import type { PortalGrant } from "@/features/clients/portal-access";
import { paymentEligibility } from "@/features/milestones/rules";

// ───────────────────────────── Payment requests (freelancer) ─────────────────────────────

export const PaymentRequestInputSchema = z.object({
  milestoneId: z.string().cuid(),
  dueInDays: z.coerce.number().int().min(0).max(120).default(7),
  note: z.string().trim().max(500).optional(),
});

export async function createPaymentRequest(userId: string, raw: unknown) {
  const input = PaymentRequestInputSchema.parse(raw);
  const m = await db.milestone.findUnique({ where: { id: input.milestoneId }, include: { project: true } });
  if (!m || m.project.ownerId !== userId) throw new DomainError("NOT_FOUND", "Milestone not found.");
  const el = paymentEligibility(m, m.project.status);
  if (!el.eligible) throw new DomainError("INVALID_STATE", el.reason);
  try {
    return await db.$transaction(async (tx) => {
      const res = await tx.milestone.updateMany({
        where: { id: m.id, paymentStatus: "UNPAID", termsStatus: "APPROVED" },
        data: { paymentStatus: "REQUESTED" },
      });
      if (res.count !== 1) throw new DomainError("CONFLICT", "The milestone changed. Please reload.");
      const pr = await tx.paymentRequest.create({
        data: {
          projectId: m.projectId,
          milestoneId: m.id,
          // Amount and currency are copied from the approved milestone — the only source of truth.
          amount: m.amount,
          currency: m.currency,
          description: input.note || `${m.project.title} — ${m.title}`,
          dueDate: new Date(Date.now() + input.dueInDays * 86_400_000),
          activeKey: m.id,
        },
      });
      await audit(tx, {
        projectId: m.projectId,
        actorType: "FREELANCER",
        actorId: userId,
        action: "payment_request.created",
        data: { paymentRequestId: pr.id, amount: toPayPalValue(pr.amount, pr.currency), currency: pr.currency },
      });
      return pr;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("CONFLICT", "A payment request is already open for this milestone.");
    }
    throw e;
  }
}

export async function cancelPaymentRequest(userId: string, paymentRequestId: string) {
  const pr = await db.paymentRequest.findUnique({ where: { id: paymentRequestId }, include: { project: true } });
  if (!pr || pr.project.ownerId !== userId) throw new DomainError("NOT_FOUND", "Payment request not found.");
  await db.$transaction(async (tx) => {
    await lockPaymentRequest(tx, pr.id);
    const res = await tx.paymentRequest.updateMany({
      where: { id: pr.id, status: "OPEN", captureLockId: null },
      data: { status: "CANCELLED", activeKey: null },
    });
    if (res.count !== 1) throw new DomainError("INVALID_STATE", "Only open payment requests with no payment in progress can be cancelled.");
    await tx.milestone.update({ where: { id: pr.milestoneId }, data: { paymentStatus: "UNPAID" } });
    await tx.paymentAttempt.updateMany({ where: { paymentRequestId: pr.id, status: "CREATED" }, data: { status: "CANCELLED" } });
    await audit(tx, { projectId: pr.projectId, actorType: "FREELANCER", actorId: userId, action: "payment_request.cancelled", data: { paymentRequestId: pr.id } });
  });
}

// ───────────────────────────── Checkout (client portal) ─────────────────────────────

async function loadRequestForGrant(grant: PortalGrant, paymentRequestId: string) {
  const pr = await db.paymentRequest.findUnique({ where: { id: paymentRequestId }, include: { project: true } });
  if (!pr || pr.projectId !== grant.projectId) throw new DomainError("NOT_FOUND", "Payment request not found.");
  return pr;
}

/** Creates a PayPal order whose amount is derived from the stored payment request (never the browser). */
export async function createCheckoutOrder(grant: PortalGrant, paymentRequestId: string) {
  const pr = await loadRequestForGrant(grant, paymentRequestId);
  if (pr.status === "PAID") throw new DomainError("INVALID_STATE", "This payment request has already been paid.");
  if (pr.status !== "OPEN") throw new DomainError("INVALID_STATE", "This payment request is not open for payment.");
  if (pr.captureLockId) throw new DomainError("CONFLICT", "A payment for this request is already being processed.");

  const gateway = getPayPalGateway();
  const attemptCount = await db.paymentAttempt.count({ where: { paymentRequestId: pr.id } });
  const requestId = `ff-order-${pr.id}-${attemptCount + 1}`;
  const amount = { currency_code: pr.currency, value: toPayPalValue(pr.amount, pr.currency) };
  let order: PayPalOrder;
  try {
    order = await gateway.createOrder({
      requestId,
      referenceId: pr.id,
      description: pr.description,
      amount,
      brandName: grant.project.owner.profile?.businessName || grant.project.owner.name,
    });
  } catch (e) {
    logPayPalError("createOrder", e);
    throw new DomainError("PAYMENT_PROVIDER_ERROR", "PayPal could not start the checkout. Please try again.");
  }
  const unit = order.purchase_units?.[0];
  if (unit?.amount && (unit.amount.value !== amount.value || unit.amount.currency_code !== amount.currency_code)) {
    throw new DomainError("PAYMENT_VERIFICATION_FAILED", "PayPal returned an unexpected amount.");
  }
  const attempt = await db.paymentAttempt.upsert({
    where: { providerOrderId: order.id },
    create: {
      paymentRequestId: pr.id,
      environment: gateway.mode,
      providerOrderId: order.id,
      amount: pr.amount,
      currency: pr.currency,
    },
    update: {},
  });
  await audit(db, { projectId: pr.projectId, actorType: "CLIENT", actorId: grant.clientId, action: "payment.order_created", data: { attemptId: attempt.id, orderId: order.id } });
  return { orderId: order.id, attemptId: attempt.id };
}

export type CaptureOutcome =
  | { status: "PAID"; transactionId: string }
  | { status: "PENDING" }
  | { status: "DECLINED"; retryable: true }
  | { status: "ALREADY_PAID" };

/** Capture after buyer approval. Safe against double clicks, refreshes and concurrent webhooks. */
export async function captureCheckoutOrder(grant: PortalGrant, paymentRequestId: string, orderId: string): Promise<CaptureOutcome> {
  const pr = await loadRequestForGrant(grant, paymentRequestId);
  const attempt = await db.paymentAttempt.findUnique({ where: { providerOrderId: orderId } });
  if (!attempt || attempt.paymentRequestId !== pr.id) throw new DomainError("NOT_FOUND", "Payment not found.");
  return captureAttempt(attempt.id, "CLIENT");
}

export async function cancelCheckoutAttempt(grant: PortalGrant, paymentRequestId: string, orderId: string) {
  const pr = await loadRequestForGrant(grant, paymentRequestId);
  await db.paymentAttempt.updateMany({
    where: { providerOrderId: orderId, paymentRequestId: pr.id, status: "CREATED" },
    data: { status: "CANCELLED" },
  });
}

async function lockPaymentRequest(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "PaymentRequest" WHERE id = ${id} FOR UPDATE`;
}

/**
 * Acquire the per-request capture lock for this attempt. Only one attempt may ever capture a
 * payment request, even if the client opened several PayPal windows.
 */
async function acquireCaptureLock(attempt: PaymentAttempt): Promise<"ACQUIRED" | "ALREADY_PAID" | "BUSY"> {
  return db.$transaction(async (tx) => {
    await lockPaymentRequest(tx, attempt.paymentRequestId);
    const pr = await tx.paymentRequest.findUniqueOrThrow({ where: { id: attempt.paymentRequestId } });
    if (pr.status === "PAID") return "ALREADY_PAID";
    if (pr.status === "CANCELLED") throw new DomainError("INVALID_STATE", "This payment request was cancelled.");
    if (pr.captureLockId && pr.captureLockId !== attempt.id) {
      const holder = await tx.paymentAttempt.findUnique({ where: { id: pr.captureLockId } });
      const stale = holder && (holder.status === "FAILED" || holder.status === "CANCELLED");
      if (!stale) return "BUSY";
    }
    await tx.paymentRequest.update({ where: { id: pr.id }, data: { captureLockId: attempt.id } });
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "CAPTURING" } });
    return "ACQUIRED";
  });
}

async function releaseCaptureLock(attemptId: string, paymentRequestId: string, status: "FAILED" | "CANCELLED" | "APPROVED" | "CREATED", error?: string) {
  await db.$transaction(async (tx) => {
    await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status, lastError: error ?? null } });
    await tx.paymentRequest.updateMany({ where: { id: paymentRequestId, captureLockId: attemptId, status: "OPEN" }, data: { captureLockId: null } });
  });
}

export async function captureAttempt(attemptId: string, actor: "CLIENT" | "SYSTEM"): Promise<CaptureOutcome> {
  const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  if (attempt.status === "COMPLETED") return { status: "ALREADY_PAID" };
  const lock = await acquireCaptureLock(attempt);
  if (lock === "ALREADY_PAID") return { status: "ALREADY_PAID" };
  if (lock === "BUSY") throw new DomainError("CONFLICT", "Another payment for this request is already being processed.");

  const gateway = getPayPalGateway();
  let order: PayPalOrder;
  try {
    // Idempotent: PayPal returns the original result if this exact request id is replayed.
    order = await gateway.captureOrder(attempt.providerOrderId, `ff-capture-${attempt.id}`);
  } catch (e) {
    if (e instanceof PayPalApiError && e.issue === "ORDER_ALREADY_CAPTURED") {
      order = await gateway.getOrder(attempt.providerOrderId);
    } else if (e instanceof PayPalApiError && e.issue === "INSTRUMENT_DECLINED") {
      await releaseCaptureLock(attempt.id, attempt.paymentRequestId, "APPROVED", "INSTRUMENT_DECLINED");
      return { status: "DECLINED", retryable: true };
    } else if (e instanceof PayPalApiError && e.issue === "ORDER_NOT_APPROVED") {
      await releaseCaptureLock(attempt.id, attempt.paymentRequestId, "CREATED", "ORDER_NOT_APPROVED");
      throw new DomainError("INVALID_STATE", "The payment has not been approved in PayPal yet.");
    } else {
      logPayPalError("captureOrder", e);
      // Unknown outcome (e.g. timeout): keep the lock and let reconciliation determine the real state.
      await db.paymentAttempt.update({ where: { id: attempt.id }, data: { lastError: errorLabel(e) } });
      throw new DomainError("PAYMENT_PROVIDER_ERROR", "We could not confirm the payment with PayPal yet. We'll keep checking — please don't pay twice.");
    }
  }
  return applyOrderState(attempt.id, order, "CAPTURE_RESPONSE", actor);
}

/**
 * Applies a PayPal order (from capture response or GET order) to our records.
 * Verifies the capture belongs to this payment request and matches amount and currency exactly.
 */
async function applyOrderState(
  attemptId: string,
  order: PayPalOrder,
  source: "CAPTURE_RESPONSE" | "RECONCILIATION",
  actor: "CLIENT" | "SYSTEM",
): Promise<CaptureOutcome> {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) {
    if (order.status === "VOIDED") {
      const a = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      await releaseCaptureLock(a.id, a.paymentRequestId, "CANCELLED", "ORDER_VOIDED");
    }
    throw new DomainError("PAYMENT_VERIFICATION_FAILED", "PayPal did not return a capture for this payment.");
  }
  return recordCapture(attemptId, capture, order.payer?.payer_id ?? null, source, actor);
}

export async function recordCapture(
  attemptId: string,
  capture: PayPalCapture,
  payerId: string | null,
  source: "CAPTURE_RESPONSE" | "WEBHOOK" | "RECONCILIATION",
  actor: "CLIENT" | "SYSTEM" | "PAYPAL",
): Promise<CaptureOutcome> {
  return db.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    await lockPaymentRequest(tx, attempt.paymentRequestId);
    const pr = await tx.paymentRequest.findUniqueOrThrow({ where: { id: attempt.paymentRequestId } });

    const expectedValue = toPayPalValue(pr.amount, pr.currency);
    const matches =
      capture.amount.currency_code === pr.currency &&
      capture.amount.value === expectedValue &&
      (capture.custom_id == null || capture.custom_id === pr.id);
    if (!matches) {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", lastError: "CAPTURE_MISMATCH" } });
      await audit(tx, {
        projectId: pr.projectId,
        actorType: "SYSTEM",
        action: "payment.verification_failed",
        data: { attemptId: attempt.id, captureId: capture.id, expected: `${expectedValue} ${pr.currency}`, got: `${capture.amount.value} ${capture.amount.currency_code}` },
      });
      throw new DomainError("PAYMENT_VERIFICATION_FAILED", "The PayPal capture did not match the payment request. It was not recorded as paid.");
    }

    const txStatus =
      capture.status === "COMPLETED"
        ? "COMPLETED"
        : capture.status === "PENDING"
          ? "PENDING"
          : capture.status === "REFUNDED"
            ? "REFUNDED"
            : "DECLINED";

    const existing = await tx.paymentTransaction.findUnique({ where: { providerCaptureId: capture.id } });
    let transaction;
    if (existing) {
      // Duplicate notification for a capture we already know: only forward transitions are applied.
      const forward = existing.status === "PENDING" && txStatus !== "PENDING";
      transaction = forward
        ? await tx.paymentTransaction.update({ where: { id: existing.id }, data: { status: txStatus, verifiedVia: source } })
        : existing;
      if (!forward && existing.status === "COMPLETED") return { status: "ALREADY_PAID" } as const;
    } else {
      transaction = await tx.paymentTransaction.create({
        data: {
          paymentRequestId: pr.id,
          attemptId: attempt.id,
          environment: attempt.environment,
          providerCaptureId: capture.id,
          amount: pr.amount,
          currency: pr.currency,
          status: txStatus,
          verifiedVia: source,
          payerId,
          capturedAt: capture.create_time ? new Date(capture.create_time) : new Date(),
        },
      });
    }

    if (transaction.status === "COMPLETED") {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", lastError: null } });
      await tx.paymentRequest.update({ where: { id: pr.id }, data: { status: "PAID", paidAt: new Date(), captureLockId: attempt.id } });
      await tx.milestone.update({ where: { id: pr.milestoneId }, data: { paymentStatus: "PAID" } });
      await audit(tx, {
        projectId: pr.projectId,
        actorType: actor,
        action: "payment.captured",
        data: { paymentRequestId: pr.id, captureId: capture.id, amount: expectedValue, currency: pr.currency, source, environment: attempt.environment },
      });
      return { status: "PAID", transactionId: transaction.id } as const;
    }
    if (transaction.status === "PENDING") {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "PENDING" } });
      await tx.paymentRequest.update({ where: { id: pr.id }, data: { status: "PROCESSING", captureLockId: attempt.id } });
      await tx.milestone.update({ where: { id: pr.milestoneId }, data: { paymentStatus: "PROCESSING" } });
      await audit(tx, { projectId: pr.projectId, actorType: actor, action: "payment.pending", data: { captureId: capture.id, reason: capture.status_details?.reason ?? null } });
      return { status: "PENDING" } as const;
    }
    // Declined / failed: release the lock so the client can try again.
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", lastError: `CAPTURE_${capture.status}` } });
    await tx.paymentRequest.update({ where: { id: pr.id }, data: { status: "OPEN", captureLockId: null } });
    await tx.milestone.update({ where: { id: pr.milestoneId }, data: { paymentStatus: "REQUESTED" } });
    await audit(tx, { projectId: pr.projectId, actorType: actor, action: "payment.declined", data: { captureId: capture.id } });
    return { status: "DECLINED", retryable: true } as const;
  });
}

// ───────────────────────────── Reconciliation ─────────────────────────────

/**
 * Asks PayPal for the authoritative order state and applies it. Used after timeouts, on page load
 * for attempts in an uncertain state, and from webhooks.
 */
export async function reconcileAttempt(attemptId: string): Promise<CaptureOutcome | { status: "NO_CHANGE"; orderStatus: string }> {
  const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  if (attempt.status === "COMPLETED") return { status: "ALREADY_PAID" };
  const order = await getPayPalGateway().getOrder(attempt.providerOrderId);
  if (order.status === "COMPLETED") return applyOrderState(attempt.id, order, "RECONCILIATION", "SYSTEM");
  if (order.status === "APPROVED") {
    if (attempt.status === "CREATED") await db.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "APPROVED" } });
    // The buyer approved but capture never completed (closed tab, timeout). Complete it now.
    return captureAttempt(attempt.id, "SYSTEM");
  }
  if (order.status === "VOIDED") {
    await releaseCaptureLock(attempt.id, attempt.paymentRequestId, "CANCELLED", "ORDER_VOIDED");
  }
  return { status: "NO_CHANGE", orderStatus: order.status };
}

/** Reconciles attempts that are in an uncertain state for one payment request. */
export async function reconcilePaymentRequest(paymentRequestId: string) {
  const attempts = await db.paymentAttempt.findMany({
    where: { paymentRequestId, status: { in: ["APPROVED", "CAPTURING", "PENDING"] } },
  });
  for (const a of attempts) {
    try {
      await reconcileAttempt(a.id);
    } catch (e) {
      console.warn("[payments] reconcile failed", a.id, errorLabel(e));
    }
  }
}

export type PaymentRequestView = PaymentRequest & { attempts: PaymentAttempt[] };

function errorLabel(e: unknown): string {
  if (e instanceof PayPalApiError) return `${e.status} ${e.issue ?? ""}`.trim();
  if (e instanceof Error) return e.name;
  return "unknown";
}

function logPayPalError(op: string, e: unknown) {
  if (e instanceof PayPalApiError) {
    console.error(`[paypal] ${op} failed`, { status: e.status, issue: e.issue, debugId: e.debugId });
  } else {
    console.error(`[paypal] ${op} failed`, e instanceof Error ? e.message : e);
  }
}
