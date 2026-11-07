import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

/**
 * Better Auth: email + password with database-backed sessions (httpOnly, secure cookies in production).
 * Better Auth validates the Origin header on state-changing requests (CSRF protection) and rate-limits
 * its own endpoints.
 */
export const auth = betterAuth({
  appName: "FreelanceFlow AI",
  baseURL: process.env.APP_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  // In development APP_URL may be a tunnel (e.g. ngrok for PayPal webhooks); keep localhost usable too.
  trustedOrigins: [
    ...new Set([
      process.env.APP_URL ?? "http://localhost:3000",
      ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
    ]),
  ],
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
