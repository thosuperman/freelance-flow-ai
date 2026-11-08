"use client";

import dynamic from "next/dynamic";
import type { FinancialDataset } from "@/features/insights/data";

// AG Studio renders in the browser only, and loads only on this page.
const FinancialStudio = dynamic(() => import("./financial-studio"), {
  ssr: false,
  loading: () => <div className="h-[640px] animate-pulse rounded-xl border bg-muted/40" aria-label="Loading analytics" />,
});

export function StudioLoader(props: { data: FinancialDataset; aiEnabled: boolean; licenseKey?: string }) {
  return <FinancialStudio {...props} />;
}
