import { NextResponse } from "next/server";
import { jsonError, noStore } from "@/lib/http/route";
import { portalRouteContext } from "@/features/portal/route-context";
import { createCheckoutOrder } from "@/features/payments/service";

/** Creates a PayPal order. The amount is derived server-side from the payment request; the body is ignored. */
export async function POST(req: Request, ctx: RouteContext<"/api/portal/[token]/payments/[paymentRequestId]/order">) {
  try {
    const { token, paymentRequestId } = await ctx.params;
    const grant = await portalRouteContext(req, token, { mutate: true, limit: 10 });
    const r = await createCheckoutOrder(grant, paymentRequestId);
    return NextResponse.json({ orderId: r.orderId }, { headers: noStore });
  } catch (e) {
    return jsonError(e);
  }
}
