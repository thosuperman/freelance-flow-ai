import { dec, isSupportedCurrency, parseMoney, splitByPercentages, sum, toAmountString } from "@/lib/money";
import type { ProjectExtraction, ScopeComparison } from "@/lib/ai/schemas";
import type { ScopeRef } from "@/lib/ai/simulated";

/**
 * Deterministic post-processing of AI output. AI suggests; this code decides what numbers are shown.
 * Anything that cannot be reconciled becomes a visible warning instead of a silent "fix".
 */

export type DraftMilestone = {
  title: string;
  description: string;
  kind: "DEPOSIT" | "DELIVERY";
  amount: string;
  dueInDays: number | null;
  basis: "stated" | "inferred";
};

export type NormalizedExtraction = {
  currency: string;
  budget: string | null;
  milestones: DraftMilestone[];
  warnings: string[];
};

export function normalizeExtraction(x: ProjectExtraction, defaultCurrency: string): NormalizedExtraction {
  const warnings: string[] = [];
  let currency = (x.budget.currency ?? defaultCurrency).toUpperCase();
  if (!isSupportedCurrency(currency)) {
    warnings.push(`Currency "${currency}" is not supported yet; using ${defaultCurrency}. Please confirm.`);
    currency = defaultCurrency;
  }
  const budget = x.budget.amount ? parseMoney(x.budget.amount, currency) : null;
  if (x.budget.amount && !budget) warnings.push(`Could not read the budget "${x.budget.amount}". Please enter it manually.`);

  const raw = x.milestones;
  let amounts: string[] = raw.map(() => "0");

  const allPct = raw.length > 0 && raw.every((m) => m.percentage != null);
  const allFixed = raw.length > 0 && raw.every((m) => m.amount != null && parseMoney(m.amount, currency));

  if (budget && allPct) {
    const pcts = raw.map((m) => dec(String(m.percentage)));
    if (sum(pcts).equals(100)) {
      amounts = splitByPercentages(budget, pcts, currency).map((d) => toAmountString(d, currency));
    } else {
      warnings.push(`Milestone percentages add up to ${sum(pcts).toString()}%, not 100%. Amounts need your review.`);
      amounts = raw.map((m) => toAmountString(budget.times(dec(String(m.percentage))).dividedBy(100), currency));
    }
  } else if (allFixed) {
    amounts = raw.map((m) => toAmountString(parseMoney(m.amount!, currency)!, currency));
  } else if (budget && raw.length > 0) {
    warnings.push("The payment split was unclear, so the budget was split evenly. Please adjust.");
    const even = raw.map(() => dec(100).dividedBy(raw.length));
    const fixedLast = [...even.slice(0, -1).map((d) => d.toDecimalPlaces(4)), dec(100).minus(sum(even.slice(0, -1).map((d) => d.toDecimalPlaces(4))))];
    amounts = splitByPercentages(budget, fixedLast, currency).map((d) => toAmountString(d, currency));
  } else if (!budget) {
    warnings.push("No budget was found. Enter the project value and milestone amounts before sending a proposal.");
  }

  if (budget && amounts.length) {
    const diff = budget.minus(sum(amounts));
    if (!diff.isZero()) {
      warnings.push(`Milestones total ${toAmountString(sum(amounts), currency)} but the budget is ${toAmountString(budget, currency)}.`);
    }
  }

  return {
    currency,
    budget: budget ? toAmountString(budget, currency) : null,
    milestones: raw.map((m, i) => ({
      title: m.title,
      description: m.description,
      kind: m.kind === "deposit" ? "DEPOSIT" : "DELIVERY",
      amount: amounts[i] ?? "0",
      dueInDays: m.dueInDays != null && m.dueInDays >= 0 && m.dueInDays < 3650 ? Math.round(m.dueInDays) : null,
      basis: m.basis,
    })),
    warnings,
  };
}

export type NormalizedComparison = ScopeComparison & {
  /** Price computed by the application (hours × hourly rate), or null when no rate is known. */
  suggestedPrice: string | null;
  priceBasis: string | null;
  droppedRefs: string[];
};

/** Removes hallucinated scope references and derives a price only from the freelancer's own rate. */
export function normalizeComparison(
  c: ScopeComparison,
  scope: ScopeRef[],
  hourlyRate: string | null,
  currency: string,
): NormalizedComparison {
  const valid = new Set(scope.map((s) => s.ref));
  const dropped: string[] = [];
  const requestedItems = c.requestedItems.map((item) => ({
    ...item,
    relatedScopeRefs: item.relatedScopeRefs.filter((r) => {
      const ok = valid.has(r);
      if (!ok) dropped.push(r);
      return ok;
    }),
  }));
  let suggestedPrice: string | null = null;
  let priceBasis: string | null = null;
  const hours = c.estimatedEffortHours;
  const hasOutOfScope = requestedItems.some((i) => i.classification === "out_of_scope");
  if (hasOutOfScope && hours != null && hours > 0 && hours < 1000 && hourlyRate) {
    const rate = parseMoney(hourlyRate, currency);
    const roundedHours = Math.round(hours * 4) / 4; // quarter-hour precision
    if (rate) {
      suggestedPrice = toAmountString(rate.times(dec(String(roundedHours))), currency);
      priceBasis = `${roundedHours} estimated hours × your hourly rate of ${toAmountString(rate, currency)} ${currency}`;
    }
  }
  return { ...c, requestedItems, suggestedPrice, priceBasis, droppedRefs: [...new Set(dropped)] };
}
