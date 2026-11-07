import { NextResponse } from "next/server";
import { handlePayPalWebhook } from "@/features/payments/webhooks";

export const dynamic = "force-dynamic";

/** PayPal webhook endpoint. Signature is verified with PayPal before anything is processed. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 512_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  try {
    const result = await handlePayPalWebhook(req.headers, raw);
    return NextResponse.json({ outcome: result.outcome }, { status: result.httpStatus });
  } catch (e) {
    console.error("[paypal] webhook handler crashed", e instanceof Error ? e.message : e);
    return NextResponse.json({ outcome: "failed" }, { status: 500 });
  }
}
