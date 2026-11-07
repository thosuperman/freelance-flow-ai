"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { extractProjectFromText } from "@/features/ai/service";
import { createProject, updateProjectTerms } from "./service";

export async function extractProjectAction(text: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return extractProjectFromText(user, String(text ?? ""));
  });
}

export async function createProjectAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const project = await createProject(user.id, input);
    revalidatePath("/app");
    return { projectId: project.id };
  });
}

export async function updateProjectTermsAction(projectId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await updateProjectTerms(user.id, projectId, input);
    revalidatePath(`/app/projects/${projectId}`);
  });
}
