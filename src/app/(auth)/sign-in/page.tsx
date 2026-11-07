import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getCurrentUser()) redirect("/app");
  const { next } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/app") ? next : "/app";
  return <AuthForm mode="sign-in" next={safeNext} />;
}
