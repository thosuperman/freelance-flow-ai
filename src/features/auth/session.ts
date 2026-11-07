import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  profile: {
    businessName: string | null;
    defaultCurrency: string;
    hourlyRate: string | null;
    isDemo: boolean;
    onboarded: boolean;
  };
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const profile = await db.freelancerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });
  if (profile.isDemo && profile.demoExpiresAt && profile.demoExpiresAt < new Date()) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    profile: {
      businessName: profile.businessName,
      defaultCurrency: profile.defaultCurrency,
      hourlyRate: profile.hourlyRate ? profile.hourlyRate.toFixed(2) : null,
      isDemo: profile.isDemo,
      onboarded: profile.onboardedAt != null,
    },
  };
});

/** For pages: redirects to sign-in when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireUserForAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("UNAUTHENTICATED", "Please sign in again.");
  return user;
}
