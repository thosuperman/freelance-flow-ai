import { requireUser } from "@/features/auth/session";
import { aiConfig } from "@/lib/ai/provider";
import { paypalConfig } from "@/lib/paypal";
import { AppSidebar, MobileNav } from "@/components/app/app-nav";
import { EnvironmentBanner } from "@/components/app/environment-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ai = aiConfig();
  const pp = paypalConfig();
  return (
    <div className="flex min-h-screen">
      <AppSidebar user={{ name: user.name, email: user.email, businessName: user.profile.businessName, isDemo: user.profile.isDemo }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={{ name: user.name, email: user.email, businessName: user.profile.businessName, isDemo: user.profile.isDemo }} />
        <EnvironmentBanner aiSimulated={ai.provider === "simulated"} paypalMode={pp.mode} paypalConfigured={pp.configured} isDemo={user.profile.isDemo} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
