import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-lg animate-fade-up py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Two quick details so proposals and change requests look right.</p>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <ProfileForm
          initial={{ businessName: user.profile.businessName ?? "", defaultCurrency: user.profile.defaultCurrency, hourlyRate: user.profile.hourlyRate ?? "" }}
          redirectTo="/app/new"
          submitLabel="Continue"
        />
      </div>
    </div>
  );
}
