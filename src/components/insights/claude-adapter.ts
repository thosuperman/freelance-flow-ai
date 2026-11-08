import type { AgAiEvent, AgLlmAdapter, AgLlmRequest, AgLlmResponse } from "ag-studio";

/**
 * Browser half of the AG Studio ↔ Claude bridge: an AgLlmAdapter that sends each agent turn to
 * this app's /api/insights/studio-turn route (session-authenticated, rate-limited, Claude key on the
 * server). The response arrives whole, and the adapter replays it as Studio content events.
 */
export function claudeAdapter(endpoint = "/api/insights/studio-turn"): AgLlmAdapter {
  return {
    executeTurn(request: AgLlmRequest, options) {
      const complete: Promise<AgLlmResponse> = fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: options?.signal,
        credentials: "same-origin",
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            return failed(String(body?.error ?? `Request failed (${res.status})`), String(body?.code ?? res.status));
          }
          return body as AgLlmResponse;
        })
        .catch((e: unknown) => (options?.signal?.aborted ? { ...failed("Cancelled", "cancelled"), status: "cancelled" as const } : failed(e instanceof Error ? e.message : "Network error", "network")));

      async function* events(): AsyncGenerator<AgAiEvent> {
        const r = await complete;
        for (const item of r.output) {
          if (item.type === "message") {
            const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("");
            yield { type: "TEXT_MESSAGE_START", messageId: item.id, role: "assistant" };
            if (text) yield { type: "TEXT_MESSAGE_CONTENT", messageId: item.id, delta: text };
            yield { type: "TEXT_MESSAGE_END", messageId: item.id };
          } else if (item.type === "function_call") {
            yield { type: "TOOL_CALL_START", toolCallId: item.callId, toolCallName: item.name };
            yield { type: "TOOL_CALL_ARGS", toolCallId: item.callId, delta: item.arguments };
            yield { type: "TOOL_CALL_END", toolCallId: item.callId };
          }
        }
      }
      return { stream: { [Symbol.asyncIterator]: events }, complete };
    },
  };
}

function failed(message: string, code: string): AgLlmResponse {
  return { id: `err_${Date.now()}`, createdAt: Date.now(), status: "failed", error: { code, message }, output: [] };
}
