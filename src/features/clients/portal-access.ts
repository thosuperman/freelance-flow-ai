import { db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { decrypt, encrypt, generateToken, sha256Hex } from "@/lib/security/tokens";

const GRANT_TTL_DAYS = 120;

/**
 * Client portal access uses unguessable, revocable, project-scoped bearer tokens.
 * Lookup is by SHA-256(token); the plaintext is never stored unencrypted.
 */
export async function issueAccessGrant(tx: Tx, projectId: string, clientId: string) {
  const token = generateToken();
  const grant = await tx.clientAccessGrant.create({
    data: {
      projectId,
      clientId,
      tokenHash: sha256Hex(token),
      tokenCiphertext: encrypt(token),
      expiresAt: new Date(Date.now() + GRANT_TTL_DAYS * 86_400_000),
    },
  });
  return { grant, token };
}

export async function ensureAccessGrant(tx: Tx, projectId: string, clientId: string) {
  const existing = await tx.clientAccessGrant.findFirst({
    where: { projectId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return (await issueAccessGrant(tx, projectId, clientId)).grant;
}

export function portalUrl(tokenCiphertext: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/portal/${decrypt(tokenCiphertext)}`;
}

export function portalPath(tokenCiphertext: string): string {
  return `/portal/${decrypt(tokenCiphertext)}`;
}

export type PortalGrant = Awaited<ReturnType<typeof resolvePortalToken>>;

/** Validates a portal token. Throws NOT_FOUND for unknown, revoked or expired tokens. */
export async function resolvePortalToken(token: string) {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) throw new DomainError("NOT_FOUND", "This link is invalid or has expired.");
  const grant = await db.clientAccessGrant.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { client: true, project: { include: { owner: { include: { profile: true } } } } },
  });
  if (!grant || grant.revokedAt || grant.expiresAt < new Date()) {
    throw new DomainError("NOT_FOUND", "This link is invalid or has expired.");
  }
  if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > 5 * 60_000) {
    await db.clientAccessGrant.update({ where: { id: grant.id }, data: { lastUsedAt: new Date() } });
  }
  return grant;
}

export async function revokeAndReissue(projectId: string, clientId: string) {
  return db.$transaction(async (tx) => {
    await tx.clientAccessGrant.updateMany({ where: { projectId, revokedAt: null }, data: { revokedAt: new Date() } });
    return issueAccessGrant(tx, projectId, clientId);
  });
}
