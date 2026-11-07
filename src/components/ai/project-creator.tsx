"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  ClipboardList,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SimulatedBadge } from "@/components/shared/status-badge";
import { TermsFields, reconciliation, toTermsPayload, type TermsFormValues } from "@/components/projects/terms-form";
import { createProjectAction, extractProjectAction } from "@/features/projects/actions";
import type { ExtractionResult } from "@/features/ai/service";
import { cn } from "@/lib/utils";

type Props = {
  initialText: string;
  tour: boolean;
  defaultCurrency: string;
  ai: { simulated: boolean; model: string };
  examples: { key: string; label: string; text: string }[];
};

const STEPS = ["Reading the conversation", "Identifying deliverables & exclusions", "Structuring milestones", "Checking for assumptions"];

function addDays(days: number | null): string {
  if (days == null) return "";
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toFormValues(r: ExtractionResult, defaultCurrency: string): TermsFormValues {
  const x = r.extraction;
  return {
    title: x.projectTitle,
    description: x.summary,
    currency: r.normalized.currency || defaultCurrency,
    budget: r.normalized.budget ?? "",
    startDate: new Date().toISOString().slice(0, 10),
    client: { name: x.clientName ?? "", email: x.clientEmail ?? "", company: "" },
    deliverables: x.deliverables.map((d) => ({ title: d.title, description: d.description, inferred: d.basis === "inferred" })),
    exclusions: x.exclusions.map((value) => ({ value })),
    acceptanceCriteria: x.acceptanceCriteria.map((value) => ({ value })),
    milestones: r.normalized.milestones.map((m) => ({
      title: m.title,
      description: m.description,
      kind: m.kind,
      amount: m.amount,
      dueDate: addDays(m.dueInDays),
      inferred: m.basis === "inferred",
    })),
  };
}

export function ProjectCreator({ initialText, tour, defaultCurrency, ai, examples }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [phase, setPhase] = useState<"input" | "analyzing" | "review">("input");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<number, "accepted" | "rejected">>({});
  const [saving, startSaving] = useTransition();

  const form = useForm<TermsFormValues>({
    defaultValues: {
      title: "",
      description: "",
      currency: defaultCurrency,
      budget: "",
      startDate: "",
      client: { name: "", email: "", company: "" },
      deliverables: [],
      exclusions: [],
      acceptanceCriteria: [],
      milestones: [],
    },
  });

  useEffect(() => {
    if (phase !== "analyzing") return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [phase]);

  async function analyze() {
    setError(null);
    setPhase("analyzing");
    setStep(0);
    const res = await extractProjectAction(text);
    if (!res.ok) {
      setPhase("input");
      setError(res.error);
      return;
    }
    setResult(res.data);
    setDecisions({});
    form.reset(toFormValues(res.data, defaultCurrency));
    setPhase("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const assumptions = result?.extraction.assumptions ?? [];
  const unresolved = assumptions.filter((_, i) => !decisions[i]).length;
  const values = form.watch();
  const rec = reconciliation(values);

  function confirm(v: TermsFormValues) {
    if (!result) return;
    if (unresolved > 0) {
      toast.error("Review every AI assumption first", { description: "Accept or reject each one so nothing unconfirmed becomes part of the agreement." });
      return;
    }
    startSaving(async () => {
      const res = await createProjectAction({
        ...toTermsPayload(v),
        client: { name: v.client.name, email: v.client.email || null, company: v.client.company || null },
        analysisId: result.analysisId,
        aiReview: {
          provider: result.provider,
          acceptedAssumptions: assumptions.filter((_, i) => decisions[i] === "accepted").map((a) => a.statement),
          rejectedAssumptions: assumptions.filter((_, i) => decisions[i] === "rejected").map((a) => a.statement),
        },
      });
      if (!res.ok) {
        toast.error("Could not create the project", { description: res.error });
        return;
      }
      toast.success("Project created", { description: "Next: review the proposal and send it to your client." });
      router.push(`/app/projects/${res.data.projectId}?tab=proposal${tour ? "&tour=1" : ""}`);
    });
  }

  if (phase !== "review") {
    return (
      <div className="mx-auto max-w-3xl animate-fade-up">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="size-3.5" /> Create project with AI
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Turn a client message into a project</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Paste a conversation, email or brief. AI drafts the scope, milestones and payment schedule — you review every detail before anything is agreed.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <label htmlFor="conversation" className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="size-4 text-muted-foreground" /> Client conversation
          </label>
          <Textarea
            id="conversation"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            disabled={phase === "analyzing"}
            placeholder="e.g. “Hi! I need a landing page for my business. Budget is $1,500…”"
            className="resize-y text-[15px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Try an example:</span>
            {examples.map((ex) => (
              <button
                key={ex.key}
                type="button"
                disabled={phase === "analyzing"}
                onClick={() => setText(ex.text)}
                className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-brand-soft disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
          {error ? (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                {error}
                <button type="button" onClick={analyze} className="ml-2 font-medium underline">
                  Retry
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {ai.simulated ? (
                <>
                  <SimulatedBadge label="Simulated AI" /> Local heuristics — configure Claude for real analysis
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-primary" /> Analysed by Claude ({ai.model}). Client text is treated as untrusted data.
                </>
              )}
            </div>
            <Button size="lg" className="h-10 px-4" onClick={analyze} disabled={phase === "analyzing" || text.trim().length < 20}>
              {phase === "analyzing" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {phase === "analyzing" ? "Analysing…" : "Analyse with AI"}
            </Button>
          </div>
        </div>

        {phase === "analyzing" ? (
          <ol className="mx-auto mt-6 max-w-sm space-y-2" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className={cn("flex items-center gap-2 text-sm transition-opacity", i > step ? "opacity-40" : "opacity-100")}>
                {i < step ? (
                  <Check className="size-4 text-emerald-600" />
                ) : i === step ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <span className="size-4 rounded-full border" />
                )}
                {s}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  const x = result!.extraction;
  return (
    <form onSubmit={form.handleSubmit(confirm)} className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={() => setPhase("input")} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to conversation
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Review the draft project</h1>
          <p className="text-sm text-muted-foreground">Nothing here is agreed yet. Edit anything, and confirm or reject each AI assumption.</p>
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={saving || unresolved > 0 || !rec.balanced}>
          {saving ? <Loader2 className="animate-spin" /> : <Check />}
          Confirm project
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border bg-surface p-4 shadow-xs sm:p-6">
          <TermsFields control={form.control} register={form.register} watch={form.watch} showClient />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border bg-card p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" /> AI review
              </h2>
              {result!.simulated ? <SimulatedBadge label="Simulated AI" /> : <span className="text-xs text-muted-foreground">{result!.model}</span>}
            </div>

            {x.suspiciousInstructions ? (
              <div className="mb-3 flex gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-800 ring-1 ring-red-200">
                <ShieldAlert className="size-4 shrink-0" />
                <span>
                  <strong>Embedded instructions ignored.</strong> {x.suspiciousInstructions}
                </span>
              </div>
            ) : null}

            {result!.normalized.warnings.length ? (
              <ul className="mb-3 space-y-1.5">
                {result!.normalized.warnings.map((w) => (
                  <li key={w} className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                    <TriangleAlert className="size-3.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Assumptions to confirm</span>
              <span className={cn(unresolved ? "text-amber-700" : "text-emerald-700")}>{unresolved ? `${unresolved} left` : "All reviewed"}</span>
            </div>
            <ul className="space-y-2" data-testid="assumptions">
              {assumptions.length === 0 ? <li className="text-xs text-muted-foreground">No assumptions were needed.</li> : null}
              {assumptions.map((a, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-lg border p-2.5 text-xs transition-colors",
                    decisions[i] === "accepted" && "border-emerald-200 bg-emerald-50/60",
                    decisions[i] === "rejected" && "border-dashed bg-muted/50 text-muted-foreground line-through",
                  )}
                >
                  <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground no-underline">{a.field}</div>
                  <p>{a.statement}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant={decisions[i] === "accepted" ? "default" : "outline"}
                      onClick={() => setDecisions((d) => ({ ...d, [i]: "accepted" }))}
                      aria-label={`Accept assumption: ${a.statement}`}
                    >
                      <Check /> Accept
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={decisions[i] === "rejected" ? "secondary" : "ghost"}
                      onClick={() => setDecisions((d) => ({ ...d, [i]: "rejected" }))}
                      aria-label={`Reject assumption: ${a.statement}`}
                    >
                      <X /> Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {assumptions.length > 1 && unresolved > 0 ? (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-primary hover:underline"
                onClick={() => setDecisions(Object.fromEntries(assumptions.map((_, i) => [i, decisions[i] ?? "accepted"])))}
              >
                Accept all remaining
              </button>
            ) : null}
            <p className="mt-2 text-[11px] text-muted-foreground">Rejecting an assumption records it; adjust the related field so it reflects what you will actually agree.</p>
          </div>

          {x.ambiguities.length ? (
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <CircleHelp className="size-4 text-muted-foreground" /> Questions to ask your client
              </h2>
              <ul className="space-y-1.5 text-xs">
                {x.ambiguities.map((a) => (
                  <li key={a.question}>
                    <span className="font-medium">{a.topic}:</span> {a.question}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {x.missingInformation.length ? (
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <ClipboardList className="size-4 text-muted-foreground" /> Missing information
              </h2>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {x.missingInformation.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="rounded-2xl border bg-card p-4 text-xs shadow-xs">
            <summary className="cursor-pointer text-sm font-semibold">Original message</summary>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{text}</p>
          </details>

          <Button type="submit" className="h-10 w-full" disabled={saving || unresolved > 0 || !rec.balanced}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Confirm project <ArrowRight />
          </Button>
          {!rec.balanced ? <p className="text-center text-xs text-amber-800">Milestones must add up to the project value.</p> : null}
        </aside>
      </div>
    </form>
  );
}
