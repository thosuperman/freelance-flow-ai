"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { compareScope } from "@/features/ai/service";
import { createChangeRequest, sendChangeRequest, withdrawChangeRequest } from "./service";

export async function compareScopeAction(projectId: string, requestText: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return compareScope(user, projectId, String(requestText ?? ""));
  });
}

export async function createChangeRequestAction(projectId: string, input: unknown, sendNow: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const cr = await createChangeRequest(user.id, projectId, input);
    if (sendNow) await sendChangeRequest(user.id, cr.id);
    revalidatePath(`/app/projects/${projectId}`);
    return { id: cr.id, number: cr.number };
  });
}

export async function sendChangeRequestAction(projectId: string, crId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await sendChangeRequest(user.id, crId);
    revalidatePath(`/app/projects/${projectId}`);
  });
}

export async function withdrawChangeRequestAction(projectId: string, crId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await withdrawChangeRequest(user.id, crId);
    revalidatePath(`/app/projects/${projectId}`);
  });
}
