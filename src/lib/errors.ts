import { ZodError } from "zod";

/**
 * Domain errors carry a stable machine code and a user-safe message.
 * Anything else thrown on the server is treated as an internal error and never shown verbatim.
 */
export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "INVALID_INPUT"
  | "INVALID_STATE"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "TERMS_MISMATCH"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_VERIFICATION_FAILED"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_OUTPUT";

const STATUS: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  INVALID_INPUT: 400,
  INVALID_STATE: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  TERMS_MISMATCH: 409,
  PAYMENT_PROVIDER_ERROR: 502,
  PAYMENT_VERIFICATION_FAILED: 502,
  AI_UNAVAILABLE: 503,
  AI_INVALID_OUTPUT: 502,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export function publicErrorMessage(e: unknown): string {
  if (isDomainError(e)) return e.message;
  return "Something went wrong. Please try again.";
}

/** Result type returned by server actions so the client never receives raw exceptions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: DomainErrorCode; fieldErrors?: Record<string, string[]> };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    // Next.js uses thrown errors for redirect()/notFound(); let those propagate.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest?: unknown }).digest === "string") {
      const digest = (e as { digest: string }).digest;
      if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw e;
    }
    if (isDomainError(e)) return { ok: false, error: e.message, code: e.code };
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      const first = e.issues[0];
      const where = first && first.path.length ? ` (${first.path.join(".")})` : "";
      return { ok: false, error: `${first?.message ?? "Invalid input"}${where}`, code: "INVALID_INPUT", fieldErrors };
    }
    console.error("[action] unexpected error", e instanceof Error ? e.message : e);
    return { ok: false, error: publicErrorMessage(e) };
  }
}
