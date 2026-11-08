"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DomainError, publicErrorMessage } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { generateToken } from "@/lib/security/tokens";
import { seedJudgeWorkspace } from "./judge-seed";

const DEMO_TTL_HOURS = 24;

/**
 * Creates an isolated, time-limited demo workspace and signs the visitor into it.
 * Each visitor gets their own data — no shared state between judges — and AI usage is capped.
 */
async function createDemoUser(h: Headers): Promise<string> {
  await rateLimit(`demo:${clientIp(h)}`, Number(process.env.DEMO_RATE_LIMIT_PER_HOUR) || 8, 60 * 60);
  const id = generateToken(9).toLowerCase().replace(/[^a-z0-9]/g, "");
  const email = `demo-${id}@demo.freelanceflow.local`;
  const res = await auth.api.signUpEmail({
    body: { name: "Alex Rivera", email, password: generateToken(24) },
    headers: h,
  });
  await db.freelancerProfile.upsert({
    where: { userId: res.user.id },
    create: {
      userId: res.user.id,
      businessName: "Rivera Studio (demo)",
      defaultCurrency: "USD",
      hourlyRate: new Prisma.Decimal("50.00"),
      isDemo: true,
      demoExpiresAt: new Date(Date.now() + DEMO_TTL_HOURS * 3_600_000),
      onboardedAt: new Date(),
    },
    update: {},
  });
  return res.user.id;
}

/**
 * Creates an isolated, time-limited demo workspace and signs the visitor into it.
 * Each visitor gets their own data — no shared state between judges — and AI usage is capped.
 */
export async function startDemoAction(): Promise<{ error: string } | void> {
  if (process.env.DEMO_MODE_ENABLED === "false") return { error: "Demo mode is disabled on this deployment." };
  const h = await headers();
  try {
    await createDemoUser(h);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("[demo] failed to start", e instanceof Error ? e.message : e);
    return { error: publicErrorMessage(e) };
  }
  redirect("/app/new?example=landing&tour=1");
}

/**
 * "Try the full demo": the same isolated workspace, pre-filled with an approved proposal, a
 * payment-ready deposit (paid for real in PayPal Sandbox by the judge) and a pending change request.
 */
export async function startFullDemoAction(): Promise<{ error: string } | void> {
  if (process.env.DEMO_MODE_ENABLED === "false") return { error: "Demo mode is disabled on this deployment." };
  const h = await headers();
  let projectId: string;
  try {
    const userId = await createDemoUser(h);
    ({ projectId } = await seedJudgeWorkspace(userId));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("[demo] failed to start full demo", e instanceof Error ? e.message : e);
    return { error: publicErrorMessage(e) };
  }
  redirect(`/app/projects/${projectId}?tour=judge`);
}
