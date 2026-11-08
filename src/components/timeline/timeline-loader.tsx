"use client";

import dynamic from "next/dynamic";
import type { Timeline } from "@/features/timeline/build";

// Bryntum Gantt touches the DOM on import, so it is loaded only in the browser and only on this tab.
const TimelineGantt = dynamic(() => import("./timeline-gantt"), {
  ssr: false,
  loading: () => <div className="h-[500px] animate-pulse rounded-xl border bg-muted/40" aria-label="Loading timeline" />,
});

export function TimelineLoader({ timeline }: { timeline: Timeline }) {
  return <TimelineGantt timeline={timeline} />;
}
