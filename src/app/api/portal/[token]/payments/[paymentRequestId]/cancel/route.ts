import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, noStore } from "@/lib/http/route";
import { portalRouteContext } from "@/features/portal/route-context";
import { cancelCheckoutAttempt } from "@/features/payments/service";

const Body = z.object({ orderId: z.string().min(5).max(64).regex(/^[A-Z0-9-]+$/i) });

export async function POST(req: Request, ctx: RouteContext<"/api/portal/[token]/payments/[paymentRequestId]/cancel">) {
  try {
    const { token, paymentRequestId } = await ctx.params;
    const grant = await portalRouteContext(req, token, { mutate: true });
    const { orderId } = Body.parse(await req.json());
    await cancelCheckoutAttempt(grant, paymentRequestId, orderId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return jsonError(e);
  }
}
