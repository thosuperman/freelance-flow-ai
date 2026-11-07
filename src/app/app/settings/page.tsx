import type { Metadata } from "next";
import { CircleCheck, CircleDashed, FlaskConical } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { aiConfig } from "@/lib/ai/provider";
import { paypalConfig } from "@/lib/paypal";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Settings" };

function Row({ ok, simulated, label, detail }: { ok: boolean; simulated?: boolean; label: string; detail: string }) {
  const Icon = simulated ? FlaskConical : ok ? CircleCheck : CircleDashed;
  return (
    <li className="flex gap-3 py-3">
      <Icon className={simulated ? "mt-0.5 size-4 text-amber-600" : ok ? "mt-0.5 size-4 text-emerald-600" : "mt-0.5 size-4 text-muted-foreground"} />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const ai = aiConfig();
  const pp = paypalConfig();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your business profile and integration status." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <h2 className="mb-4 font-semibold">Business profile</h2>
          <ProfileForm initial={{ businessName: user.profile.businessName ?? "", defaultCurrency: user.profile.defaultCurrency, hourlyRate: user.profile.hourlyRate ?? "" }} />
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-xs">
          <h2 className="mb-2 font-semibold">Integrations</h2>
          <ul className="divide-y">
            <Row
              ok={ai.configured}
              simulated={ai.provider === "simulated"}
              label={ai.provider === "anthropic" ? `AI: Claude (${ai.model})` : "AI: simulated heuristics"}
              detail={ai.provider === "anthropic" ? "Structured outputs validated against application schemas." : "Set ANTHROPIC_API_KEY to enable real Claude analysis. Simulated results are labelled."}
            />
            <Row
              ok={pp.configured}
              simulated={pp.mode === "mock"}
              label={pp.mode === "mock" ? "PayPal: simulated test gateway" : `PayPal ${pp.mode === "live" ? "Live" : "Sandbox"} — Orders v2`}
              detail={pp.mode === "mock" ? "For automated tests only. Set PAYPAL_MODE=sandbox with Sandbox credentials for real checkout." : pp.configured ? "Server-side order creation and capture." : "Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET."}
            />
            <Row
              ok={pp.webhookConfigured}
              simulated={pp.mode === "mock"}
              label="PayPal webhooks"
              detail={pp.webhookConfigured ? `Signature verification enabled. Endpoint: ${appUrl}/api/webhooks/paypal` : `Set PAYPAL_WEBHOOK_ID. Endpoint: ${appUrl}/api/webhooks/paypal`}
            />
          </ul>
        </section>
      </div>
    </div>
  );
}
