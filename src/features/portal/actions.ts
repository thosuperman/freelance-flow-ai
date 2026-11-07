"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { sha256Hex } from "@/lib/security/tokens";
import { resolvePortalToken } from "@/features/clients/portal-access";
import { decideProposal } from "@/features/proposals/service";
import { clientReviewMilestone } from "@/features/milestones/service";
import { decideChangeRequest } from "@/features/scope-changes/service";

async function portalContext(token: string) {
  const h = await headers();
  await rateLimit(`portal:${sha256Hex(token).slice(0, 24)}:${clientIp(h)}`, 30, 60);
  const grant = await resolvePortalToken(token);
  return { grant, userAgent: h.get("user-agent") };
}

export async function decideProposalAction(token: string, input: unknown) {
  return runAction(async () => {
    const { grant, userAgent } = await portalContext(token);
    const r = await decideProposal(grant, input, userAgent);
    revalidatePath(`/portal/${token}`);
    return r;
  });
}

export async function reviewMilestoneAction(token: string, input: unknown) {
  return runAction(async () => {
    const { grant, userAgent } = await portalContext(token);
    await clientReviewMilestone(grant, input, userAgent);
    revalidatePath(`/portal/${token}`);
  });
}

export async function decideChangeRequestAction(token: string, input: unknown) {
  return runAction(async () => {
    const { grant, userAgent } = await portalContext(token);
    await decideChangeRequest(grant, input, userAgent);
    revalidatePath(`/portal/${token}`);
  });
}
