"use client";

import { useFieldArray, type Control, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import { CircleAlert, CircleCheck, Plus, Sparkles, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_CURRENCIES, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TermsFormValues = {
  title: string;
  description: string;
  currency: string;
  budget: string;
  startDate: string;
  client: { name: string; email: string; company: string };
  deliverables: { title: string; description: string; inferred: boolean }[];
  exclusions: { value: string }[];
  acceptanceCriteria: { value: string }[];
  milestones: { title: string; description: string; kind: "DEPOSIT" | "DELIVERY"; amount: string; dueDate: string; inferred: boolean }[];
};

export function toTermsPayload(v: TermsFormValues) {
  return {
    title: v.title,
    description: v.description,
    currency: v.currency,
    budget: v.budget.replace(/,/g, "").trim(),
    startDate: v.startDate || null,
    deliverables: v.deliverables.map((d) => ({ title: d.title, description: d.description })),
    exclusions: v.exclusions.map((e) => e.value).filter((x) => x.trim()),
    acceptanceCriteria: v.acceptanceCriteria.map((c) => c.value).filter((x) => x.trim()),
    milestones: v.milestones.map((m) => ({
      title: m.title,
      description: m.description,
      kind: m.kind,
      amount: m.amount.replace(/,/g, "").trim(),
      dueDate: m.dueDate || null,
    })),
  };
}

function safeDecimal(v: string): Decimal | null {
  const s = (v ?? "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return new Decimal(s);
}

export function reconciliation(v: Pick<TermsFormValues, "budget" | "milestones" | "currency">) {
  const budget = safeDecimal(v.budget);
  let total = new Decimal(0);
  let invalid = false;
  for (const m of v.milestones) {
    const d = safeDecimal(m.amount);
    if (!d) invalid = true;
    else total = total.plus(d);
  }
  return { budget, total, invalid, balanced: !invalid && budget != null && total.equals(budget) };
}

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
      <Sparkles className="size-3" /> AI assumption
    </span>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold">{children}</h3>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TermsFields({
  control,
  register,
  watch,
  showClient,
}: {
  control: Control<TermsFormValues>;
  register: UseFormRegister<TermsFormValues>;
  watch: UseFormWatch<TermsFormValues>;
  showClient: boolean;
}) {
  const deliverables = useFieldArray({ control, name: "deliverables" });
  const exclusions = useFieldArray({ control, name: "exclusions" });
  const criteria = useFieldArray({ control, name: "acceptanceCriteria" });
  const milestones = useFieldArray({ control, name: "milestones" });
  const values = watch();
  const rec = reconciliation(values);
  const currency = values.currency || "USD";
  const fmt = (d: Decimal) => {
    try {
      return formatMoney(d.toFixed(2), currency);
    } catch {
      return d.toFixed(2);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Project</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">Project title</Label>
            <Input id="title" {...register("title", { required: true })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description", { required: true })} />
          </div>
          {showClient ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="client.name">Client name</Label>
                <Input id="client.name" placeholder="e.g. Jordan Lee" {...register("client.name", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client.email">Client email</Label>
                <Input id="client.email" type="email" placeholder="optional" {...register("client.email")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="client.company">Company</Label>
                <Input id="client.company" placeholder="optional" {...register("client.company")} />
              </div>
            </>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="budget">Project value</Label>
            <div className="flex gap-2">
              <select
                aria-label="Currency"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                {...register("currency")}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input id="budget" inputMode="decimal" className="tabular min-w-0 flex-1" {...register("budget", { required: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
          </div>
        </div>
      </section>

      <section>
        <SectionTitle hint="What the client receives. This becomes the approved scope used for scope-change detection.">
          Deliverables
        </SectionTitle>
        <div className="space-y-3">
          {deliverables.fields.map((f, i) => (
            <div key={f.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input aria-label={`Deliverable ${i + 1} title`} className="font-medium" {...register(`deliverables.${i}.title`, { required: true })} />
                    {values.deliverables[i]?.inferred ? <AIBadge /> : null}
                  </div>
                  <Textarea aria-label={`Deliverable ${i + 1} description`} rows={2} {...register(`deliverables.${i}.description`)} />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove deliverable" onClick={() => deliverables.remove(i)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => deliverables.append({ title: "", description: "", inferred: false })}>
            <Plus /> Add deliverable
          </Button>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <SectionTitle hint="Listing exclusions up front is your best protection against scope creep.">Not included</SectionTitle>
          <div className="space-y-2">
            {exclusions.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input aria-label={`Exclusion ${i + 1}`} {...register(`exclusions.${i}.value`)} />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove exclusion" onClick={() => exclusions.remove(i)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => exclusions.append({ value: "" })}>
              <Plus /> Add exclusion
            </Button>
          </div>
        </section>
        <section>
          <SectionTitle hint="How the client decides the work is done.">Acceptance criteria</SectionTitle>
          <div className="space-y-2">
            {criteria.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input aria-label={`Acceptance criterion ${i + 1}`} {...register(`acceptanceCriteria.${i}.value`)} />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove criterion" onClick={() => criteria.remove(i)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => criteria.append({ value: "" })}>
              <Plus /> Add criterion
            </Button>
          </div>
        </section>
      </div>

      <section>
        <SectionTitle hint="Payment milestones. Amounts must add up exactly to the project value.">Milestones & payment schedule</SectionTitle>
        <div className="space-y-3">
          {milestones.fields.map((f, i) => {
            const amt = safeDecimal(values.milestones[i]?.amount ?? "");
            const pct = amt && rec.budget && !rec.budget.isZero() ? amt.dividedBy(rec.budget).times(100).toDecimalPlaces(1).toString() : null;
            return (
              <div key={f.id} className="rounded-xl border bg-card p-3" data-testid="milestone-row">
                <div className="flex items-start gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</div>
                  <div className="grid flex-1 gap-2 sm:grid-cols-12">
                    <div className="flex items-center gap-2 sm:col-span-12">
                      <Input aria-label={`Milestone ${i + 1} title`} className="font-medium" {...register(`milestones.${i}.title`, { required: true })} />
                      {values.milestones[i]?.inferred ? <AIBadge /> : null}
                    </div>
                    <Textarea aria-label={`Milestone ${i + 1} description`} rows={2} className="sm:col-span-12" {...register(`milestones.${i}.description`)} />
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <select
                        aria-label={`Milestone ${i + 1} type`}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                        {...register(`milestones.${i}.kind`)}
                      >
                        <option value="DEPOSIT">Deposit — payable on approval</option>
                        <option value="DELIVERY">Delivery — payable on acceptance</option>
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs text-muted-foreground">Amount ({currency}){pct ? ` · ${pct}%` : ""}</Label>
                      <Input aria-label={`Milestone ${i + 1} amount`} inputMode="decimal" className="tabular" {...register(`milestones.${i}.amount`, { required: true })} />
                    </div>
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs text-muted-foreground">Due date</Label>
                      <Input aria-label={`Milestone ${i + 1} due date`} type="date" {...register(`milestones.${i}.dueDate`)} />
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove milestone" onClick={() => milestones.remove(i)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => milestones.append({ title: "", description: "", kind: "DELIVERY", amount: "0", dueDate: "", inferred: false })}
            >
              <Plus /> Add milestone
            </Button>
            <div
              data-testid="reconciliation"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                rec.balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
              )}
            >
              {rec.balanced ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
              {rec.invalid
                ? "Check milestone amounts"
                : rec.budget
                  ? rec.balanced
                    ? `Milestones total ${fmt(rec.total)} — matches project value`
                    : `Milestones total ${fmt(rec.total)} · project value ${fmt(rec.budget)}`
                  : "Enter the project value"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
