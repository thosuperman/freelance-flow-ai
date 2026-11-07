import "server-only";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { sha256Hex } from "@/lib/security/tokens";
import { assertSameOrigin } from "@/lib/http/route";
import { resolvePortalToken } from "@/features/clients/portal-access";

/** Shared guard for portal payment endpoints: same-origin, rate limit, valid token. */
export async function portalRouteContext(req: Request, token: string, opts: { mutate: boolean; limit?: number }) {
  if (opts.mutate) assertSameOrigin(req);
  await rateLimit(`portal-pay:${sha256Hex(token).slice(0, 24)}:${clientIp(req.headers)}`, opts.limit ?? 20, 60);
  return resolvePortalToken(token);
}
