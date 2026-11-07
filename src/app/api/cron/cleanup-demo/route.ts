import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeEqualHex, sha256Hex } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

/**
 * Deletes expired demo workspaces (and, via cascades, their projects). Intended for Vercel Cron.
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqualHex(sha256Hex(auth), sha256Hex(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await db.freelancerProfile.findMany({ where: { isDemo: true, demoExpiresAt: { lt: new Date() } }, select: { userId: true }, take: 200 });
  let deleted = 0;
  for (const { userId } of expired) {
    // Payment records are retained with Restrict FKs; delete in dependency order for demo data only.
    await db.$transaction(async (tx) => {
      const projects = await tx.project.findMany({ where: { ownerId: userId }, select: { id: true } });
      const ids = projects.map((p) => p.id);
      await tx.paymentTransaction.deleteMany({ where: { paymentRequest: { projectId: { in: ids } } } });
      await tx.paymentRequest.deleteMany({ where: { projectId: { in: ids } } });
      await tx.scopeItem.deleteMany({ where: { projectId: { in: ids } } });
      await tx.milestone.deleteMany({ where: { projectId: { in: ids } } });
      await tx.scopeChangeRequest.deleteMany({ where: { projectId: { in: ids } } });
      await tx.project.deleteMany({ where: { id: { in: ids } } });
      await tx.user.delete({ where: { id: userId } });
    });
    deleted++;
  }
  return NextResponse.json({ deleted });
}
