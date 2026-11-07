import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256-bit random token, URL safe. Unguessable by construction. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY must be 32 bytes (base64)");
  return key;
}

/** AES-256-GCM. Output: base64url(iv).base64url(tag).base64url(ciphertext) */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [ivB, tagB, ctB] = payload.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
}

/** Deterministic JSON serialisation (sorted keys) used for hashing agreed terms. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        const v = (value as Record<string, unknown>)[k];
        if (v !== undefined) acc[k] = sortKeys(v);
        return acc;
      }, {});
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function hashTerms(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
