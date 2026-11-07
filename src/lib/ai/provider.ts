import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { DomainError } from "@/lib/errors";
import { simulatedGenerate } from "./simulated";

/**
 * AI provider abstraction. Each task supplies a Zod schema; providers must return data that
 * validates against it. Adding another provider (e.g. Gemini) means implementing `AIProvider`.
 */
export type AITask<T> = {
  /** Logical task name — used by the simulated provider to pick a heuristic. */
  task: "extractProject" | "draftProposal" | "compareScope";
  schema: z.ZodType<T>;
  system: string;
  user: string;
  /** Structured context for the simulated provider (the real model only sees `user`). */
  context: unknown;
  maxTokens?: number;
};

export type AIResult<T> = { data: T; provider: string; model: string; simulated: boolean };

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly simulated: boolean;
  generate<T>(task: AITask<T>): Promise<AIResult<T>>;
}

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly simulated = false;
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string, timeoutMs: number) {
    this.model = model;
    // baseURL is explicit so the server never inherits an unrelated ANTHROPIC_BASE_URL from the shell.
    this.client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_API_BASE_URL || "https://api.anthropic.com",
      timeout: timeoutMs,
      maxRetries: 2,
    });
  }

  async generate<T>(task: AITask<T>): Promise<AIResult<T>> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: task.maxTokens ?? 16000,
        system: task.system,
        messages: [{ role: "user", content: task.user }],
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: betaZodOutputFormat(task.schema) },
        // Server-side fallback if the primary model declines a request (routes by refusal category).
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) {
        throw new DomainError("AI_UNAVAILABLE", "The AI service timed out. Please try again.");
      }
      if (e instanceof Anthropic.RateLimitError) {
        throw new DomainError("AI_UNAVAILABLE", "The AI service is busy. Please try again in a minute.");
      }
      if (e instanceof Anthropic.AuthenticationError) {
        console.error("[ai] authentication failed — check ANTHROPIC_API_KEY");
        throw new DomainError("AI_UNAVAILABLE", "The AI service is not configured correctly.");
      }
      if (e instanceof Anthropic.APIError) {
        console.error("[ai] API error", e.status, e.message);
        throw new DomainError("AI_UNAVAILABLE", "The AI service is unavailable right now.");
      }
      if (e instanceof Anthropic.APIConnectionError) {
        throw new DomainError("AI_UNAVAILABLE", "Could not reach the AI service.");
      }
      // Parse failures from the SDK helper (malformed JSON / schema mismatch).
      console.error("[ai] unexpected error", e instanceof Error ? e.message : e);
      throw new DomainError("AI_INVALID_OUTPUT", "The AI returned an unexpected response. Please try again.");
    }

    if (response.stop_reason === "refusal") {
      throw new DomainError("AI_UNAVAILABLE", "The AI declined to analyse this text.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new DomainError("AI_INVALID_OUTPUT", "The AI response was cut off. Try a shorter input.");
    }
    // Defence in depth: re-validate even though the SDK parsed against the same schema.
    const parsed = task.schema.safeParse(response.parsed_output);
    if (!parsed.success) {
      throw new DomainError("AI_INVALID_OUTPUT", "The AI returned data in an unexpected format. Please try again.");
    }
    return { data: parsed.data, provider: this.name, model: response.model ?? this.model, simulated: false };
  }
}

class SimulatedProvider implements AIProvider {
  readonly name = "simulated";
  readonly model = "heuristic-v1";
  readonly simulated = true;

  async generate<T>(task: AITask<T>): Promise<AIResult<T>> {
    const raw = simulatedGenerate(task.task, task.context);
    const parsed = task.schema.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError("AI_INVALID_OUTPUT", "Simulated analysis produced invalid output.");
    }
    return { data: parsed.data, provider: this.name, model: this.model, simulated: true };
  }
}

export type AIConfig = { provider: "anthropic" | "simulated"; model: string; configured: boolean };

export function aiConfig(): AIConfig {
  const explicit = process.env.AI_PROVIDER?.trim();
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const provider = explicit === "simulated" ? "simulated" : explicit === "anthropic" || hasKey ? "anthropic" : "simulated";
  return {
    provider,
    model: provider === "anthropic" ? process.env.AI_MODEL?.trim() || "claude-opus-5-5" : "heuristic-v1",
    configured: provider === "anthropic" ? hasKey : true,
  };
}

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const cfg = aiConfig();
  if (cfg.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) throw new DomainError("AI_UNAVAILABLE", "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
    cached = new AnthropicProvider(key, cfg.model, Number(process.env.AI_TIMEOUT_MS) || 90_000);
  } else {
    cached = new SimulatedProvider();
  }
  return cached;
}

/** Test hook. */
export function setAIProviderForTests(p: AIProvider | null) {
  cached = p;
}
