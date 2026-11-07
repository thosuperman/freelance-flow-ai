"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, CircleHelp, Loader2, Plus, Send, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SimulatedBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { compareScopeAction, createChangeRequestAction } from "@/features/scope-changes/actions";
import type { ComparisonResult } from "@/features/ai/service";
import type { ScopeRef } from "@/lib/ai/simulated";
import { cn } from "@/lib/utils";

const CLASS_META = {
  in_scope: { label: "Within approved scope", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: CircleCheck },
  out_of_scope: { label: "Outside approved scope", tone: "bg-red-50 text-red-800 ring-red-200", icon: ShieldAlert },
  partially_out_of_scope: { label: "Partly outside approved scope", tone: "bg-amber-50 text-amber-900 ring-amber-200", icon: CircleAlert },
  unclear: { label: "Unclear — clarify first", tone: "bg-sky-50 text-sky-800 ring-sky-200", icon: CircleHelp },
} as const;

const ITEM_TONE = { in_scope: "text-emerald-700", out_of_scope: "text-red-700", unclear: "text-sky-700" } as const;

const KIND_LABEL: Record<ScopeRef["kind"], string> = { deliverable: "Deliverable", exclusion: "Exclusion", criterion: "Acceptance", added: "Added by CR" };

type Draft = { title: string; description: string; deliverables: { title: string; description: string }[]; amount: string; billingTiming: "ON_APPROVAL" | "ON_DELIVERY"; dueDate: string };

export function ScopeChecker({
  projectId,
  currency,
  scope,
  example,
  simulated,
  hourlyRate,
}: {
  projectId: string;
  currency: string;
  scope: ScopeRef[];
  example: string;
  simulated: boolean;
  hourlyRate: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    const res = await compareScopeAction(projectId, text);
    setAnalyzing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data);
    const c = res.data.comparison;
    setDraft(
      c.draftChangeRequest
        ? {
            title: c.draftChangeRequest.title,
            description: c.draftChangeRequest.description,
            deliverables: c.draftChangeRequest.deliverables,
            amount: c.suggestedPrice ?? "",
            billingTiming: "ON_APPROVAL",
            dueDate: "",
          }
        : null,
    );
  }

  function createCr(sendNow: boolean) {
    if (!draft || !result) return;
    start(async () => {
      const res = await createChangeRequestAction(
        projectId,
        { ...draft, requestText: text, analysisId: result.analysisId, dueDate: draft.dueDate || null },
        sendNow,
      );
      if (!res.ok) {
        toast.error("Could not create the change request", { description: res.error });
        return;
      }
      toast.success(sendNow ? `Change request #${res.data.number} sent to your client` : `Change request #${res.data.number} saved as draft`);
      setResult(null);
      setDraft(null);
      setText("");
      router.refresh();
    });
  }

  const c = result?.comparison;
  const cited = new Set(c?.requestedItems.flatMap((i) => i.relatedScopeRefs) ?? []);
  const meta = c ? CLASS_META[c.classification] : null;

  return (
    <section aria-label="Scope check" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="size-4 text-primary" /> Scope check
            </h2>
            {simulated ? <SimulatedBadge label="Simulated AI" /> : null}
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Paste a new client request. AI compares it with the approved scope and shows exactly which terms it used.</p>
          <Label htmlFor="scope-request" className="sr-only">
            New client request
          </Label>
          <Textarea id="scope-request" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. “Can you also add a booking system?”" />
          {error ? (
            <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setText(example)}>
              Insert example request
            </button>
            <Button onClick={analyze} disabled={analyzing || text.trim().length < 5} data-testid="run-scope-check">
              {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />} Check against scope
            </Button>
          </div>
        </div>

        {c && meta ? (
          <div className="animate-fade-up space-y-4" data-testid="scope-result">
            <div className={cn("rounded-2xl p-4 ring-1 ring-inset", meta.tone)}>
              <div className="flex flex-wrap items-center gap-2">
                <meta.icon className="size-5" />
                <span className="text-base font-semibold" data-testid="scope-classification">
                  {meta.label}
                </span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">{c.confidence} confidence</span>
              </div>
              <p className="mt-2 text-sm">{c.reasoningSummary}</p>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <h3 className="mb-2 text-sm font-semibold">What the client is asking for</h3>
              <ul className="space-y-2.5">
                {c.requestedItems.map((item, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", ITEM_TONE[item.classification])}>{item.description}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.classification.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.explanation}</p>
                    {item.relatedScopeRefs.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.relatedScopeRefs.map((r) => (
                          <span key={r} title={scope.find((s) => s.ref === r)?.text} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                            {r}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {c.droppedRefs.length ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Ignored references not present in the approved scope: {c.droppedRefs.join(", ")}.</p>
              ) : null}
            </div>

            {c.clarifyingQuestions.length ? (
              <div className="rounded-2xl border bg-card p-4 text-sm shadow-xs">
                <h3 className="mb-1.5 font-semibold">Clarifying questions</h3>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {c.clarifyingQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-2xl border bg-card p-4 text-sm shadow-xs">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="font-semibold">Suggested reply to your client</h3>
                <CopyButton value={c.clientReplyDraft} label="Copy" variant="ghost" />
              </div>
              <p className="whitespace-pre-line text-muted-foreground">{c.clientReplyDraft}</p>
            </div>

            {draft ? (
              <div className="rounded-2xl border-2 border-primary/20 bg-surface p-4 shadow-sm sm:p-5" data-testid="change-request-form">
                <h3 className="font-semibold">Create change request</h3>
                <p className="mb-4 text-sm text-muted-foreground">Your client must approve it before the scope and project value change.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cr-title">Title</Label>
                    <Input id="cr-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cr-desc">Description</Label>
                    <Textarea id="cr-desc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Additional deliverables</Label>
                    {draft.deliverables.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          aria-label={`Deliverable ${i + 1}`}
                          value={d.title}
                          onChange={(e) => setDraft({ ...draft, deliverables: draft.deliverables.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove deliverable"
                          onClick={() => setDraft({ ...draft, deliverables: draft.deliverables.filter((_, j) => j !== i) })}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, deliverables: [...draft.deliverables, { title: "", description: "" }] })}>
                      <Plus /> Add
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cr-amount">Additional price ({currency})</Label>
                    <Input
                      id="cr-amount"
                      inputMode="decimal"
                      className="tabular"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                      placeholder="Enter your price"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {c.suggestedPrice
                        ? `Suggested from ${c.priceBasis}. AI never sets prices.`
                        : hourlyRate
                          ? "Not enough detail to estimate effort — enter your price."
                          : "Set an hourly rate in Settings to get a suggestion. AI never sets prices."}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cr-billing">Billing</Label>
                    <select
                      id="cr-billing"
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                      value={draft.billingTiming}
                      onChange={(e) => setDraft({ ...draft, billingTiming: e.target.value as Draft["billingTiming"] })}
                    >
                      <option value="ON_APPROVAL">Payable once approved</option>
                      <option value="ON_DELIVERY">Payable after delivery is accepted</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cr-due">Due date (optional)</Label>
                    <Input id="cr-due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                  <Button variant="outline" disabled={pending} onClick={() => createCr(false)}>
                    Save as draft
                  </Button>
                  <Button disabled={pending || !draft.amount} onClick={() => createCr(true)} data-testid="send-change-request">
                    {pending ? <Loader2 className="animate-spin" /> : <Send />} Send to client for approval
                  </Button>
                </div>
              </div>
            ) : c.classification !== "in_scope" ? (
              <Button
                variant="outline"
                onClick={() =>
                  setDraft({ title: "Additional work", description: text.slice(0, 500), deliverables: [{ title: "Additional work", description: "" }], amount: "", billingTiming: "ON_APPROVAL", dueDate: "" })
                }
              >
                <Plus /> Create a change request anyway
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <h3 className="mb-1 text-sm font-semibold">Approved scope used for comparison</h3>
          <p className="mb-3 text-xs text-muted-foreground">Highlighted items were cited by the analysis.</p>
          <ul className="space-y-1.5" data-testid="scope-refs">
            {scope.map((s) => (
              <li
                key={s.ref}
                data-cited={cited.has(s.ref) ? "true" : "false"}
                className={cn("rounded-lg border p-2 text-xs transition-colors", cited.has(s.ref) ? "border-primary/40 bg-brand-soft" : "border-transparent bg-muted/40")}
              >
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="font-mono font-semibold">{s.ref}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{KIND_LABEL[s.kind]}</span>
                </div>
                <p className={cn(s.kind === "exclusion" && "text-muted-foreground")}>{s.text}</p>
              </li>
            ))}
          </ul>
          {c?.estimatedEffortHours != null ? (
            <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-xs">
              <span className="font-medium">Estimated effort:</span> ~{c.estimatedEffortHours}h{c.effortRationale ? ` — ${c.effortRationale}` : ""}
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
