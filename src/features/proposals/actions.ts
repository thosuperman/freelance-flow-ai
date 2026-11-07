"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { draftProposalWithAI } from "@/features/ai/service";
import { portalPath, revokeAndReissue } from "@/features/clients/portal-access";
import { assertProjectOwner } from "@/features/projects/access";
import { saveProposal, sendProposal, withdrawProposal } from "./service";

export async function draftProposalAIAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return draftProposalWithAI(user, projectId);
  });
}

export async function saveProposalAction(projectId: string, fields: unknown, aiGenerated = false) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await saveProposal(user.id, projectId, fields, aiGenerated);
    revalidatePath(`/app/projects/${projectId}`);
  });
}

export async function sendProposalAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const v = await sendProposal(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`);
    revalidatePath("/app");
    return { version: v.version };
  });
}

export async function withdrawProposalAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await withdrawProposal(user.id, projectId);
    revalidatePath(`/app/projects/${projectId}`);
  });
}

export async function regeneratePortalLinkAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const project = await assertProjectOwner(user.id, projectId);
    const { grant } = await revokeAndReissue(project.id, project.clientId);
    await db.auditEvent.create({ data: { projectId, actorType: "FREELANCER", actorId: user.id, action: "portal.link_regenerated" } });
    revalidatePath(`/app/projects/${projectId}`);
    return { path: portalPath(grant.tokenCiphertext) };
  });
}
