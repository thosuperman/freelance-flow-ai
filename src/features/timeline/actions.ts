"use server";

import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { explainProjectTimeline } from "./service";

export async function explainTimelineAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const r = await explainProjectTimeline(user, String(projectId ?? ""));
    return { ...r.data, simulated: r.simulated, model: r.model };
  });
}
