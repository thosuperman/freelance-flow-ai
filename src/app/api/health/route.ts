import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiConfig } from "@/lib/ai/provider";
import { paypalConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }
  const ai = aiConfig();
  const pp = paypalConfig();
  return NextResponse.json(
    { status: database === "ok" ? "ok" : "degraded", database, ai: { provider: ai.provider, configured: ai.configured }, paypal: { mode: pp.mode, configured: pp.configured, webhook: pp.webhookConfigured } },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
