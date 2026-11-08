import { describe, expect, it } from "vitest";
import { StudioTurnSchema, toClaudeMessages, toClaudeTools, toStudioResponse } from "@/features/insights/studio-turn";

const turn = (over: Record<string, unknown> = {}) =>
  StudioTurnSchema.parse({
    instructions: "You are the data agent.",
    input: [
      { kind: "input", type: "message", role: "system", content: [{ type: "text", text: "Page context" }], status: "completed", id: "s1" },
      { kind: "input", type: "message", role: "user", content: [{ type: "text", text: "Which projects are overdue?" }], status: "completed", id: "u1" },
      { kind: "output", type: "function_call", id: "fc1", callId: "call_1", name: "query_data", arguments: '{"table":"paymentRequests"}' },
      { type: "function_call_output", callId: "call_1", output: "[]", status: "completed" },
      { kind: "output", type: "reasoning", id: "r1", summary: [] },
    ],
    tools: [{ name: "query_data", description: "Query a table", parameters: { type: "object", properties: { table: { type: "string" } } } }],
    toolChoice: "auto",
    responseFormat: { type: "text" },
    ...over,
  });

describe("AG Studio ↔ Claude bridge", () => {
  it("maps Studio conversation items to alternating Claude messages and a system prompt", () => {
    const { system, messages } = toClaudeMessages(turn());
    expect(system).toBe("You are the data agent.\n\nPage context");
    expect(messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Which projects are overdue?" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "call_1", name: "query_data", input: { table: "paymentRequests" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "[]" }] },
    ]);
  });

  it("maps tool choice and turns a JSON response format into a forced tool", () => {
    expect(toClaudeTools(turn({ toolChoice: "required" })).toolChoice).toEqual({ type: "any" });
    expect(toClaudeTools(turn({ toolChoice: { name: "query_data" } })).toolChoice).toEqual({ type: "tool", name: "query_data" });
    const json = toClaudeTools(turn({ responseFormat: { type: "json", name: "plan", schema: { type: "object", properties: { steps: { type: "array" } } } } }));
    expect(json.toolChoice).toEqual({ type: "tool", name: "studio_structured_response" });
    expect(json.tools.map((t) => t.name)).toEqual(["query_data", "studio_structured_response"]);
  });

  it("converts Claude text and tool calls back into Studio output items", () => {
    const r = toStudioResponse(
      {
        id: "msg_1",
        model: "claude-sonnet-5-5",
        stop_reason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 5 } as never,
        content: [
          { type: "text", text: "Checking the data.", citations: null } as never,
          { type: "tool_use", id: "toolu_1", name: "query_data", input: { table: "projects" } } as never,
        ],
      },
      turn(),
    );
    expect(r.status).toBe("completed");
    expect(r.output).toEqual([
      { id: "msg_msg_1", kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: "Checking the data.", annotations: [] }] },
      { id: "fc_toolu_1", kind: "output", type: "function_call", callId: "toolu_1", name: "query_data", arguments: '{"table":"projects"}', status: "completed" },
    ]);
  });

  it("returns forced JSON as the assistant message for structured turns", () => {
    const t = turn({ responseFormat: { type: "json", name: "plan", schema: { type: "object" } } });
    const r = toStudioResponse(
      { id: "m2", model: "x", stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } as never, content: [{ type: "tool_use", id: "t", name: "studio_structured_response", input: { steps: [1] } } as never] },
      t,
    );
    expect(r.output).toEqual([expect.objectContaining({ type: "message", content: [{ type: "text", text: '{"steps":[1]}', annotations: [] }] })]);
  });

  it("marks truncated turns as incomplete", () => {
    const r = toStudioResponse({ id: "m3", model: "x", stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 1 } as never, content: [] }, turn());
    expect(r).toMatchObject({ status: "incomplete", incompleteDetails: { reason: "max_output_tokens" } });
  });

  it("rejects malformed turns", () => {
    expect(() => StudioTurnSchema.parse({ input: "nope", responseFormat: { type: "text" } })).toThrow();
  });
});
