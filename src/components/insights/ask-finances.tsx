"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimulatedBadge } from "@/components/shared/status-badge";
import { askFinancesAction } from "@/features/insights/actions";

const EXAMPLES = [
  "Which projects have overdue payments?",
  "How much additional revenue came from scope changes?",
  "What payments are expected this month?",
  "Which projects have the greatest outstanding balance?",
];

type Result = { answer: string; cited: { id: string; label: string; value: string }[]; simulated: boolean };

export function AskFinances() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const ask = (question: string) =>
    start(async () => {
      setQ(question);
      const r = await askFinancesAction(question);
      if (r.ok) setResult(r.data);
      else toast.error(r.error);
    });
  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="ask-finances">
      <h2 id="ask-finances" className="font-semibold">
        Ask your finances
      </h2>
      <p className="text-sm text-muted-foreground">Numbers are computed by FreelanceFlow from your records, per currency. AI only explains them and shows the figures it used.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q.trim());
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Which projects have overdue payments?" maxLength={500} aria-label="Question" />
        <Button type="submit" disabled={pending || !q.trim()}>
          <Sparkles className="size-4" />
          {pending ? "Thinking…" : "Ask"}
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={() => ask(e)} disabled={pending}>
            {e}
          </button>
        ))}
      </div>
      {result ? (
        <div className="mt-3 space-y-2 text-sm" data-testid="ask-finances-result">
          <p className="flex flex-wrap items-center gap-2">
            {result.answer}
            {result.simulated ? <SimulatedBadge /> : null}
          </p>
          {result.cited.length ? (
            <ul className="space-y-1 rounded-md bg-muted p-3 text-xs">
              {result.cited.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">{c.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
