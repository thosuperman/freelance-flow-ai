"use client";

import dynamic from "next/dynamic";
import type { Timeline } from "@/features/timeline/build";

// Bryntum Gantt touches the DOM on import, so it is loaded only in the browser and only on this tab.
const TimelineGantt = dynamic(() => import("./timeline-gantt"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-sm text-muted-foreground" role="status" aria-label="Loading timeline">
      <span className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Loading the Bryntum timeline… (first visit downloads about 2 MB)
    </div>
  ),
});

export function TimelineLoader({ timeline }: { timeline: Timeline }) {
  return <TimelineGantt timeline={timeline} />;
}
