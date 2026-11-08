"use client";

import dynamic from "next/dynamic";
import type { FinancialDataset } from "@/features/insights/data";

// AG Studio renders in the browser only, and loads only on this page.
const FinancialStudio = dynamic(() => import("./financial-studio"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[640px] flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-sm text-muted-foreground" role="status" aria-label="Loading analytics">
      <span className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Loading AG Studio analytics… (first visit downloads about 2 MB)
    </div>
  ),
});

export function StudioLoader(props: { data: FinancialDataset; aiEnabled: boolean; licenseKey?: string }) {
  return <FinancialStudio {...props} />;
}
