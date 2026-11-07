import { NextResponse } from "next/server";
import { z } from "zod";
import { paypalConfig } from "@/lib/paypal";
import { mockApproveOrder } from "@/lib/paypal/mock-gateway";
import { assertSameOrigin, jsonError } from "@/lib/http/route";

/**
 * SIMULATED buyer approval for PAYPAL_MODE=mock only. Stands in for the PayPal popup in automated tests.
 * Returns 404 in every other mode.
 */
export async function POST(req: Request) {
  if (paypalConfig().mode !== "mock") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    assertSameOrigin(req);
    const { orderId } = z.object({ orderId: z.string().startsWith("MOCK-") }).parse(await req.json());
    const ok = mockApproveOrder(orderId);
    return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
  } catch (e) {
    return jsonError(e);
  }
}
