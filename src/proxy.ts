import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic route protection: if there is no session cookie at all, redirect to sign-in early.
 * Real authorization always happens server-side (requireUser + per-project ownership checks).
 */
export function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request);
  if (!cookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
