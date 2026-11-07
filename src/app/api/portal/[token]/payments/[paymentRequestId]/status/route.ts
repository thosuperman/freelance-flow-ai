import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { jsonError, noStore } from "@/lib/http/route";
import { portalRouteContext } from "@/features/portal/route-context";
import { reconcilePaymentRequest } from "@/features/payments/service";

/** Returns the authoritative status, reconciling with PayPal first if a payment is in an uncertain state. */
export async function GET(req: Request, ctx: RouteContext<"/api/portal/[token]/payments/[paymentRequestId]/status">) {
  try {
    const { token, paymentRequestId } = await ctx.params;
    const grant = await portalRouteContext(req, token, { mutate: false, limit: 40 });
    const pr = await db.paymentRequest.findUnique({ where: { id: paymentRequestId } });
    if (!pr || pr.projectId !== grant.projectId) throw new DomainError("NOT_FOUND", "Payment request not found.");
    if (pr.status !== "PAID") await reconcilePaymentRequest(pr.id);
    const fresh = await db.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } });
    return NextResponse.json({ status: fresh.status }, { headers: noStore });
  } catch (e) {
    return jsonError(e);
  }
}
