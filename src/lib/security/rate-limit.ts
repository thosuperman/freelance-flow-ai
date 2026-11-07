import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

/**
 * Fixed-window rate limiter backed by Postgres so it holds across serverless instances.
 * One atomic upsert per check; no extra infrastructure required.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" < ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) {
    throw new DomainError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
  }
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
