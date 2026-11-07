"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { freelancerMilestoneAction } from "./service";

export async function milestoneWorkAction(projectId: string, milestoneId: string, action: "start" | "submit", note?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (action !== "start" && action !== "submit") throw new Error("invalid action");
    await freelancerMilestoneAction(user.id, milestoneId, action, note);
    revalidatePath(`/app/projects/${projectId}`);
  });
}
