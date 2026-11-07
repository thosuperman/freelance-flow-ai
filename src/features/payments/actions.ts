"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { cancelPaymentRequest, createPaymentRequest } from "./service";

export async function createPaymentRequestAction(projectId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const pr = await createPaymentRequest(user.id, input);
    revalidatePath(`/app/projects/${projectId}`);
    revalidatePath("/app");
    return { id: pr.id };
  });
}

export async function cancelPaymentRequestAction(projectId: string, paymentRequestId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await cancelPaymentRequest(user.id, paymentRequestId);
    revalidatePath(`/app/projects/${projectId}`);
  });
}
