import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DomainError } from "@/lib/errors";

/**
 * Server half of the AG Studio ↔ Claude bridge. AG Studio's agent framework calls
 * `AgLlmAdapter.executeTurn()` in the browser; our adapter (components/insights/claude-adapter.ts)
 * POSTs the turn here, and this module runs it on Claude and returns Studio's response shape.
 *
 * - Studio tool schemas become Claude tools; Studio's JSON response format becomes a forced tool
 *   call whose input is the JSON (Claude accepts any JSON Schema as a tool input schema).
 * - Function calls and their outputs map to tool_use / tool_result blocks.
 * - Studio's reasoning items are skipped: this bridge does not request extended thinking.
 */

const Item = z.object({ type: z.string(), kind: z.string().optional() }).passthrough();
export const StudioTurnSchema = z.object({
  input: z.array(Item).max(400),
  instructions: z.string().max(200_000).optional(),
  tools: z
    .array(z.object({ name: z.string().min(1).max(128), description: z.string().max(20_000).default(""), parameters: z.record(z.string(), z.unknown()) }).passthrough())
    .max(64)
    .optional(),
  toolChoice: z.union([z.enum(["auto", "none", "required"]), z.object({ name: z.string() })]).optional(),
  responseFormat: z.union([
    z.object({ type: z.literal("text") }),
    z.object({ type: z.literal("json"), name: z.string(), description: z.string().optional(), schema: z.record(z.string(), z.unknown()) }),
  ]),
});
export type StudioTurn = z.infer<typeof StudioTurnSchema>;

const JSON_TOOL = "studio_structured_response";

type Block = Anthropic.ContentBlockParam;
type Message = Anthropic.MessageParam;

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text ?? "") : c && typeof c === "object" && "refusal" in c ? String((c as { refusal: unknown }).refusal) : ""))
    .filter(Boolean)
    .join("\n");
}

function safeJson(s: unknown): Record<string, unknown> {
  if (typeof s !== "string") return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : { value: v };
  } catch {
    return {};
  }
}

/** Converts Studio's conversation items into Claude system text and alternating messages. */
export function toClaudeMessages(turn: StudioTurn): { system: string; messages: Message[] } {
  const system: string[] = [];
  if (turn.instructions) system.push(turn.instructions);
  const messages: Message[] = [];
  const push = (role: "user" | "assistant", block: Block) => {
    const last = messages.at(-1);
    if (last && last.role === role && Array.isArray(last.content)) (last.content as Block[]).push(block);
    else messages.push({ role, content: [block] });
  };
  for (const raw of turn.input) {
    const item = raw as Record<string, unknown>;
    if (item.type === "message") {
      const text = textOf(item.content);
      if (!text) continue;
      if (item.role === "system") system.push(text);
      else push(item.role === "assistant" ? "assistant" : "user", { type: "text", text });
    } else if (item.type === "function_call") {
      push("assistant", { type: "tool_use", id: String(item.callId), name: String(item.name), input: safeJson(item.arguments) });
    } else if (item.type === "function_call_output") {
      push("user", { type: "tool_result", tool_use_id: String(item.callId), content: String(item.output ?? "") });
    }
    // reasoning items are intentionally dropped
  }
  if (!messages.length || messages[0]!.role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "(start)" }] });
  return { system: system.join("\n\n"), messages };
}

export function toClaudeTools(turn: StudioTurn): { tools: Anthropic.Tool[]; toolChoice: Anthropic.ToolChoice | undefined } {
  const tools: Anthropic.Tool[] = (turn.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: { type: "object", ...(t.parameters as object) } as Anthropic.Tool.InputSchema,
  }));
  if (turn.responseFormat.type === "json") {
    tools.push({
      name: JSON_TOOL,
      description: `Return the final answer as structured data (${turn.responseFormat.name}). ${turn.responseFormat.description ?? ""}`.trim(),
      input_schema: { type: "object", ...(turn.responseFormat.schema as object) } as Anthropic.Tool.InputSchema,
    });
    return { tools, toolChoice: { type: "tool", name: JSON_TOOL } };
  }
  const c = turn.toolChoice;
  if (!tools.length || c === undefined || c === "auto") return { tools, toolChoice: tools.length ? { type: "auto" } : undefined };
  if (c === "none") return { tools, toolChoice: { type: "none" } };
  if (c === "required") return { tools, toolChoice: { type: "any" } };
  return { tools, toolChoice: { type: "tool", name: c.name } };
}

/** Converts a Claude message into Studio output items (assistant text and function calls). */
export function toStudioResponse(msg: Pick<Anthropic.Message, "id" | "content" | "stop_reason" | "model" | "usage">, turn: StudioTurn) {
  const output: Record<string, unknown>[] = [];
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  const json = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === JSON_TOOL);
  if (turn.responseFormat.type === "json" && json) {
    output.push({ id: `msg_${msg.id}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: JSON.stringify(json.input), annotations: [] }] });
  } else if (text) {
    output.push({ id: `msg_${msg.id}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text, annotations: [] }] });
  }
  for (const b of msg.content) {
    if (b.type === "tool_use" && b.name !== JSON_TOOL) {
      output.push({ id: `fc_${b.id}`, kind: "output", type: "function_call", callId: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}), status: "completed" });
    }
  }
  const incomplete = msg.stop_reason === "max_tokens";
  return {
    id: msg.id,
    createdAt: Date.now(),
    status: incomplete ? "incomplete" : "completed",
    ...(incomplete ? { incompleteDetails: { reason: "max_output_tokens" } } : {}),
    output,
    model: msg.model,
    usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
  };
}

let client: Anthropic | null = null;

export async function runStudioTurn(turn: StudioTurn, signal?: AbortSignal) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new DomainError("AI_UNAVAILABLE", "The AI assistant needs ANTHROPIC_API_KEY on the server.");
  client ??= new Anthropic({ apiKey: key, baseURL: process.env.ANTHROPIC_API_BASE_URL || "https://api.anthropic.com", timeout: 90_000, maxRetries: 2 });
  const { system, messages } = toClaudeMessages(turn);
  const { tools, toolChoice } = toClaudeTools(turn);
  try {
    const msg = await client.messages.create(
      {
        model: process.env.AI_MODEL?.trim() || "claude-opus-5-5",
        max_tokens: 8000,
        system: [
          "You are the analytics assistant inside FreelanceFlow AI's Financial Intelligence dashboard (AG Studio).",
          "Money is in several currencies: never add or compare amounts across currencies; filter or group by currency.",
          "There is no cost data, so never talk about profit or margins. Use the data tools for every number.",
          system,
        ]
          .filter(Boolean)
          .join("\n\n"),
        messages,
        ...(tools.length ? { tools, tool_choice: toolChoice } : {}),
      },
      { signal },
    );
    return toStudioResponse(msg, turn);
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error("[insights] Claude turn failed", e.status, e.name);
      throw new DomainError("AI_UNAVAILABLE", "The AI assistant is unavailable right now. Please try again.");
    }
    throw e;
  }
}
