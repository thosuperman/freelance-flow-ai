import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError, isDomainError } from "@/lib/errors";

/** Rejects cross-site state-changing requests (CSRF defence for JSON route handlers). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new DomainError("FORBIDDEN", "Missing origin.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new DomainError("FORBIDDEN", "Invalid origin.");
  }
  if (originHost !== host) throw new DomainError("FORBIDDEN", "Cross-site request blocked.");
}

export function jsonError(e: unknown) {
  if (isDomainError(e)) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", code: "INVALID_INPUT" }, { status: 400 });
  console.error("[api] unexpected error", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "INTERNAL" }, { status: 500 });
}

export const noStore = { "Cache-Control": "no-store" };
