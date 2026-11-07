import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthForm mode="sign-up" next="/app/onboarding" />;
}
