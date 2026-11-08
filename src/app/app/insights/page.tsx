import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { buildFinancialDataset } from "@/features/insights/data";
import { aiConfig } from "@/lib/ai/provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StudioLoader } from "@/components/insights/studio-loader";
import { AskFinances } from "@/components/insights/ask-finances";

export const metadata: Metadata = { title: "Financial Intelligence" };

export default async function InsightsPage() {
  const user = await requireUser();
  const data = await buildFinancialDataset(user.id);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Financial Intelligence"
        description="Revenue, payment risk and scope-change impact from your approved agreements and verified PayPal payments. Amounts stay in their own currency."
      />
      {data.projects.length === 0 ? (
        <EmptyState icon={BarChart3} title="No projects yet" description="Create a project to see revenue, payment risk and scope-change analytics here." />
      ) : (
        <>
          <AskFinances />
          <StudioLoader data={data} aiEnabled={aiConfig().provider === "anthropic"} licenseKey={process.env.AG_STUDIO_LICENSE_KEY || undefined} />
          <p className="text-xs text-muted-foreground">
            Analytics by AG Studio (trial). The Studio assistant runs on Claude through FreelanceFlow&apos;s server and only sees your own records. Customized layouts are saved in this browser.
          </p>
        </>
      )}
    </div>
  );
}
