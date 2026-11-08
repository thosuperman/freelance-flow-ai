"use server";

import { runAction } from "@/lib/errors";
import { requireUserForAction } from "@/features/auth/session";
import { answerFinancialQuestion } from "@/features/ai/service";
import { buildFinancialDataset } from "./data";

/** Answers from facts computed by code for the signed-in freelancer only; the model only explains them. */
export async function askFinancesAction(question: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const data = await buildFinancialDataset(user.id);
    const r = await answerFinancialQuestion(user, String(question ?? ""), data.facts);
    const cited = data.facts.filter((f) => r.data.citedIds.includes(f.id));
    return { answer: r.data.answer, cited, simulated: r.simulated };
  });
}
