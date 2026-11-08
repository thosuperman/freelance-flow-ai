"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { explainTimelineAction } from "@/features/timeline/actions";

type Insight = { headline: string; explanation: string; recommendations: string[]; clientMessage: string | null; simulated: boolean };

/** AI explains the computed schedule; it never changes dates or amounts. */
export function TimelineInsight({ projectId }: { projectId: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await explainTimelineAction(projectId);
      if (r.ok) setInsight(r.data);
      else toast.error(r.error);
    });
  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="timeline-insight">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="timeline-insight" className="font-semibold">
            Schedule check
          </h3>
          <p className="text-sm text-muted-foreground">AI explains the risks the timeline found. It never changes approved dates or amounts.</p>
        </div>
        <Button type="button" variant="outline" onClick={run} disabled={pending}>
          <Sparkles className="size-4" />
          {pending ? "Checking…" : insight ? "Check again" : "Explain schedule risk"}
        </Button>
      </div>
      {insight ? (
        <div className="mt-3 space-y-2 text-sm" data-testid="timeline-insight-result">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {insight.headline}
            {insight.simulated ? <SimulatedBadge /> : null}
          </p>
          <p className="text-muted-foreground">{insight.explanation}</p>
          {insight.recommendations.length ? (
            <ul className="list-disc space-y-0.5 pl-5">
              {insight.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          {insight.clientMessage ? (
            <div className="rounded-md bg-muted p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested message to your client</span>
                <CopyButton value={insight.clientMessage} />
              </div>
              <p>{insight.clientMessage}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
