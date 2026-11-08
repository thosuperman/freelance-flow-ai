import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError, noStore } from "@/lib/http/route";
import { DomainError } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { aiConfig } from "@/lib/ai/provider";
import { getCurrentUser } from "@/features/auth/session";
import { StudioTurnSchema, runStudioTurn } from "@/features/insights/studio-turn";

const MAX_BODY_BYTES = 1_500_000;

/**
 * One AG Studio agent turn, run on Claude. Signed-in users only; the Anthropic key stays on the
 * server. One user question can take several turns (the agent calls Studio's data tools), so the
 * limits are per turn: per user, per demo workspace and site-wide per day.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", "Please sign in again.");
    if (aiConfig().provider !== "anthropic") {
      throw new DomainError("AI_UNAVAILABLE", "The analytics assistant needs live Claude (ANTHROPIC_API_KEY); the simulated provider cannot drive it.");
    }
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new DomainError("INVALID_INPUT", "Conversation too long. Start a new chat.");
    await rateLimit(`studio-ai:${user.id}`, 60, 60 * 10);
    if (user.profile.isDemo) await rateLimit(`studio-ai-demo:${user.id}`, 80, 60 * 60 * 24);
    await rateLimit("studio-ai:global:day", Number(process.env.AI_STUDIO_DAILY_TURNS) || 800, 60 * 60 * 24);

    const turn = StudioTurnSchema.parse(await req.json());
    const response = await runStudioTurn(turn, req.signal);
    return NextResponse.json(response, { headers: noStore });
  } catch (e) {
    return jsonError(e);
  }
}
