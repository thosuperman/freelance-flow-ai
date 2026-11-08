/**
 * SIMULATED AI — deterministic local fallback used when no AI provider key is configured.
 *
 * It uses transparent keyword and pattern heuristics, not a language model. Every result produced
 * here is stored with provider "simulated" and labelled "Simulated AI" in the UI. It exists so the
 * product (and automated tests) work offline; the real analysis runs through the Claude provider.
 */
import { formatMoney, isSupportedCurrency } from "@/lib/money";
import type { ProjectExtraction, ProposalDraft, ScopeComparison } from "./schemas";

export type ExtractContext = { text: string; defaultCurrency: string };
export type ProposalContext = {
  title: string;
  clientName: string;
  description: string;
  currency: string;
  budget: string;
  deliverables: { title: string; description: string }[];
  exclusions: string[];
  milestones: { title: string; kind: string; amount: string; dueDate: string | null }[];
  acceptanceCriteria: string[];
};
export type ScopeRef = { ref: string; kind: "deliverable" | "exclusion" | "criterion" | "added"; text: string };
export type CompareContext = { scope: ScopeRef[]; requestText: string };

export function simulatedGenerate(task: string, context: unknown): unknown {
  switch (task) {
    case "extractProject":
      return simulateExtraction(context as ExtractContext);
    case "draftProposal":
      return simulateProposal(context as ProposalContext);
    case "compareScope":
      return simulateComparison(context as CompareContext);
    case "explainTimeline":
      return simulateTimelineInsight(context as TimelineInsightContext);
    case "financialAnswer":
      return simulateFinancialAnswer(context as FinancialAnswerContext);
    default:
      throw new Error(`Unknown simulated task: ${task}`);
  }
}

// ───────────────────────────── helpers ─────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, twenty: 20, thirty: 30,
};

function toNumber(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return NUMBER_WORDS[t] ?? null;
}

const NUM = String.raw`(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty|thirty)`;

function daysFrom(numToken: string, unit: string): number | null {
  const n = toNumber(numToken);
  if (n == null) return null;
  return /week/i.test(unit) ? n * 7 : /month/i.test(unit) ? n * 30 : n;
}

function findDays(text: string, keywords: string): number | null {
  const re = new RegExp(String.raw`(?:${keywords})[^.?!]{0,40}?(?:in|within|by|after)\s+${NUM}\s+(days?|weeks?|months?)`, "i");
  const m = text.match(re);
  if (m) return daysFrom(m[1]!, m[2]!);
  const re2 = new RegExp(String.raw`(?:${keywords})[^.?!]{0,30}?next week`, "i");
  if (re2.test(text)) return 7;
  return null;
}

const CURRENCY_SYMBOLS: [RegExp, string][] = [
  [/€|\beur(os?)?\b/i, "EUR"],
  [/£|\bgbp\b|\bpounds?\b/i, "GBP"],
  [/¥|\bjpy\b|\byen\b/i, "JPY"],
  [/\bcad\b|c\$/i, "CAD"],
  [/\baud\b|a\$/i, "AUD"],
  [/\bsgd\b|s\$/i, "SGD"],
  [/\busd\b|us\$|\$|\bdollars?\b/i, "USD"],
];

function findBudget(text: string): { amount: string | null; currency: string | null; currencyExplicit: boolean } {
  const m =
    text.match(/(?:US\$|C\$|A\$|S\$|\$|€|£|¥)\s?(\d[\d,]*(?:\.\d{1,2})?)\s?(k\b)?/i) ??
    text.match(/(\d[\d,]*(?:\.\d{1,2})?)\s?(k\b)?\s?(?:usd|eur|gbp|jpy|cad|aud|sgd|dollars|euros|pounds|yen)\b/i) ??
    text.match(/budget[^.\d]{0,20}(\d[\d,]*(?:\.\d{1,2})?)\s?(k\b)?/i);
  if (!m) return { amount: null, currency: null, currencyExplicit: false };
  let amount = Number(m[1]!.replace(/,/g, ""));
  if (m[2]) amount *= 1000;
  const around = text.slice(Math.max(0, (m.index ?? 0) - 4), (m.index ?? 0) + m[0].length + 8);
  let currency: string | null = null;
  for (const [re, code] of CURRENCY_SYMBOLS) {
    if (re.test(around)) {
      currency = code;
      break;
    }
  }
  const explicit = currency != null && /usd|eur|gbp|jpy|cad|aud|sgd|euro|pound|yen|€|£|¥/i.test(around);
  return { amount: String(amount), currency, currencyExplicit: explicit };
}

type ProjectKind = { key: string; test: RegExp; title: string; deliverables: { title: string; description: string }[] };

const PROJECT_KINDS: ProjectKind[] = [
  {
    key: "landing",
    test: /landing page/i,
    title: "Business Landing Page",
    deliverables: [
      { title: "Landing page design", description: "Visual design of a single responsive landing page, delivered as a first draft for review." },
      { title: "Landing page build", description: "Production-ready responsive implementation of the approved design." },
    ],
  },
  {
    key: "website",
    test: /website|web site|marketing site/i,
    title: "Marketing Website",
    deliverables: [
      { title: "Website design", description: "Responsive design for the agreed set of pages." },
      { title: "Website build", description: "Implementation of the approved pages, including a contact form." },
    ],
  },
  {
    key: "logo",
    test: /logo|brand identity|branding/i,
    title: "Logo & Brand Identity",
    deliverables: [
      { title: "Logo concepts", description: "Initial logo concepts for review." },
      { title: "Final logo files", description: "Final logo in vector and raster formats." },
    ],
  },
  {
    key: "app",
    test: /mobile app|ios app|android app|\bapp\b/i,
    title: "Mobile App MVP",
    deliverables: [
      { title: "App screens design", description: "Design of the core app screens." },
      { title: "App MVP build", description: "Working build of the agreed core features." },
    ],
  },
];

const INJECTION = /ignore (all |any )?(previous|prior|above) (instructions|prompts)|disregard (the|all|your) (rules|instructions)|you are now|system prompt|set the price to/i;

// ───────────────────────────── extraction ─────────────────────────────

function simulateExtraction(ctx: ExtractContext): ProjectExtraction {
  const text = ctx.text;
  const kind = PROJECT_KINDS.find((k) => k.test.test(text));
  const budget = findBudget(text);
  const depositMatch =
    text.match(/(\d{1,2})\s?%\s*(?:up\s?front|upfront|deposit|in advance|advance|to start|before)/i) ??
    text.match(/(?:deposit|upfront|up front|advance)[^.%\d]{0,20}(\d{1,2})\s?%/i);
  const halfNow = /\bhalf (now|upfront|up front|in advance|to start)\b/i.test(text);
  const depositPct = depositMatch ? Number(depositMatch[1]) : halfNow ? 50 : null;
  // Multi-step schedules like "40% on signing, 30% on approval of the concept and 30% on final delivery".
  const steps = [...text.matchAll(/(\d{1,3})\s?%\s+(?:on|upon|at|when|after)\s+([^,.;%]+?)(?=\s+and\s+\d|\s*[,.;]|\s*$)/gi)].map((m) => ({ pct: Number(m[1]), label: m[2]!.trim() }));
  const stepsTotal = steps.reduce((a, x) => a + x.pct, 0);
  const draftDays = findDays(text, "first draft|draft|first version|mockup|concepts?");
  const finalDays = findDays(text, "final delivery|final version|final files|final|finished|deliver(?:y|ed)?|launch|live|deadline|done|complete");
  const assumptions: ProjectExtraction["assumptions"] = [];
  const ambiguities: ProjectExtraction["ambiguities"] = [];
  const missing: string[] = [];

  let currency = budget.currency;
  if (budget.amount && !currency) {
    currency = ctx.defaultCurrency;
    assumptions.push({ field: "currency", statement: `No currency was stated; assumed ${currency} (your default currency).` });
  } else if (budget.amount && currency && !budget.currencyExplicit) {
    assumptions.push({ field: "currency", statement: `"$" was read as ${currency}. Confirm the client is not paying in another dollar currency.` });
  }

  const deliverables: ProjectExtraction["deliverables"] = (kind?.deliverables ?? [
    { title: "Project deliverable", description: "Main deliverable described by the client (please refine)." },
  ]).map((d) => ({ ...d, basis: "inferred" as const }));
  if (draftDays != null) {
    deliverables.unshift({
      title: "First draft for review",
      description: `A first draft shared with the client within ${draftDays} days of project start.`,
      basis: "stated",
    });
  }
  if (!kind) {
    ambiguities.push({ topic: "Deliverables", question: "What exactly should be delivered at the end of the project?" });
  }

  const milestones: ProjectExtraction["milestones"] = [];
  const finalDue = finalDays ?? (draftDays != null ? draftDays + 7 : null);
  if (finalDays == null && draftDays != null) {
    assumptions.push({ field: "timeline", statement: `No final deadline was given; assumed final delivery one week after the first draft (day ${finalDue}).` });
  }
  if (steps.length >= 2 && stepsTotal === 100) {
    steps.forEach((st, i) => {
      const isDeposit = i === 0 && /sign|approv(al|e) of (this|the) (proposal|agreement)|start|kick|upfront|order/i.test(st.label);
      const label = st.label.replace(/^the\s+/i, "");
      const isLast = i === steps.length - 1;
      milestones.push({
        title: isDeposit ? "Deposit on signing" : label.charAt(0).toUpperCase() + label.slice(1),
        description: `${st.pct}% ${isDeposit ? "due when the proposal is approved" : `due on ${label}`}.`,
        kind: isDeposit ? "deposit" : "delivery",
        percentage: st.pct,
        amount: null,
        dueInDays: isDeposit ? 0 : isLast ? finalDays : draftDays,
        deliverableTitles: isLast ? deliverables.map((d) => d.title) : [],
        basis: "stated",
      });
    });
  } else if (depositPct != null && depositPct > 0 && depositPct < 100) {
    milestones.push({
      title: "Upfront deposit",
      description: `${depositPct}% deposit due when the proposal is approved, before work starts.`,
      kind: "deposit",
      percentage: depositPct,
      amount: null,
      dueInDays: 0,
      deliverableTitles: [],
      basis: "stated",
    });
    milestones.push({
      title: "Final delivery and approval",
      description:
        draftDays != null
          ? `First draft by day ${draftDays}; final delivery by day ${finalDue}. Remaining ${100 - depositPct}% due when the client accepts the final work.`
          : `Remaining ${100 - depositPct}% due when the client accepts the final work.`,
      kind: "delivery",
      percentage: 100 - depositPct,
      amount: null,
      dueInDays: finalDue,
      deliverableTitles: deliverables.map((d) => d.title),
      basis: /rest|remaining|balance|remainder/i.test(text) ? "stated" : "inferred",
    });
  } else {
    milestones.push(
      {
        title: "Kick-off deposit",
        description: "50% deposit due when the proposal is approved.",
        kind: "deposit",
        percentage: 50,
        amount: null,
        dueInDays: 0,
        deliverableTitles: [],
        basis: "inferred",
      },
      {
        title: "Final delivery",
        description: "Remaining 50% due when the client accepts the final work.",
        kind: "delivery",
        percentage: 50,
        amount: null,
        dueInDays: finalDue,
        deliverableTitles: deliverables.map((d) => d.title),
        basis: "inferred",
      },
    );
    assumptions.push({ field: "payment schedule", statement: "No payment split was stated; suggested a 50% deposit and 50% on final delivery." });
  }

  if (!budget.amount) missing.push("Total budget");
  if (finalDue == null) missing.push("Delivery deadline");
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const chatHeader = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\(([^)]+)\):/m);
  const name =
    chatHeader?.[1] ??
    text.match(/(?:I'm|I am|this is|my name is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ??
    text.match(/(?:thanks|cheers|regards|best),?\s*\n?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*$/im)?.[1] ??
    null;
  if (!name) missing.push("Client name and contact details");

  assumptions.push(
    { field: "timeline", statement: "Project start is the day the client approves the proposal." },
    { field: "content", statement: "The client provides all text, images and brand assets." },
  );
  ambiguities.push(
    { topic: "Content", question: "Will you provide the copy and images, or should I source them?" },
    { topic: "Hosting", question: "Do you already have a domain and hosting, or should that be included?" },
  );

  const exclusions = [
    kind?.key === "landing" ? "Additional pages beyond the single landing page" : "Work not listed under deliverables",
    "Copywriting and stock photography purchases",
    "Domain, hosting and third-party subscription fees",
    "Booking systems, e-commerce, payments or user account functionality",
  ];

  return {
    projectTitle: kind?.title ?? "New Client Project",
    clientName: name,
    clientEmail: email,
    summary: `${kind ? `Design and build of a ${kind.title.toLowerCase()}` : "Client project"}${
      budget.amount && currency ? ` with a total budget of ${isSupportedCurrency(currency) ? formatMoney(budget.amount, currency) : `${budget.amount} ${currency}`}` : ""
    }${finalDue != null ? `, delivered within ${finalDue} days` : ""}.`,
    deliverables,
    exclusions,
    budget: { amount: budget.amount, currency, basis: budget.amount ? "stated" : "missing" },
    milestones,
    paymentTerms: depositPct != null ? `${depositPct}% upfront, remainder on completion.` : null,
    acceptanceCriteria: [
      "The final work matches the approved first draft plus agreed revisions.",
      "The page is responsive on current mobile and desktop browsers.",
    ],
    assumptions,
    ambiguities,
    missingInformation: missing,
    suspiciousInstructions: INJECTION.test(text)
      ? "The message contains text that tries to instruct an AI system. It was ignored."
      : null,
  };
}

// ───────────────────────────── proposal ─────────────────────────────

function simulateProposal(p: ProposalContext): ProposalDraft {
  const deposit = p.milestones.find((m) => m.kind === "DEPOSIT");
  const last = p.milestones[p.milestones.length - 1];
  return {
    overview: `Hi ${p.clientName}, thank you for the opportunity. This proposal covers the ${p.title.toLowerCase()}: ${p.description} Below you will find exactly what is included, what is not, and how payments are scheduled, so we both have a clear shared picture before work begins.`,
    timelineSummary: p.milestones
      .map((m) => `${m.title}${m.dueDate ? ` — by ${m.dueDate}` : ""}`)
      .join("; ") + ".",
    paymentConditions: `${deposit ? `The ${deposit.title.toLowerCase()} is due on approval of this proposal, before work starts. ` : ""}${
      last ? `The final payment is due once you confirm the final delivery is complete. ` : ""
    }All payments are made securely through PayPal against a payment request for a specific milestone.`,
    revisionLimit: 2,
    revisionPolicy:
      "Two rounds of revisions are included for each deliverable. Revisions refine the agreed scope; new features or pages are handled as change requests.",
    changeRequestPolicy:
      "Requests outside the agreed deliverables are written up as a change request with a description and a price. Work on them starts only after you approve the change request, and they are billed separately.",
    acceptanceStatement:
      "When a milestone is delivered you can review it in your client portal and either accept it or request changes. Accepted milestones become payable.",
    suggestedExclusions: p.exclusions.length ? [] : ["Domain, hosting and third-party subscription fees"],
  };
}

// ───────────────────────────── scope comparison ─────────────────────────────

type Feature = { key: string; label: string; patterns: RegExp; hours: number; deliverables: { title: string; description: string }[] };

const FEATURES: Feature[] = [
  {
    key: "booking",
    label: "booking / appointment scheduling system",
    patterns: /\b(booking|bookings|appointment|appointments|scheduling|schedule (calls|appointments)|calendar booking|reservations?)\b/i,
    hours: 6,
    deliverables: [
      { title: "Booking system", description: "Online booking flow so visitors can pick an available time slot and receive a confirmation email." },
    ],
  },
  {
    key: "accounts",
    label: "customer accounts / login",
    patterns: /\b(customer accounts?|user accounts?|log ?in|sign ?up|member(ship)? area|registration|accounts)\b/i,
    hours: 10,
    deliverables: [{ title: "Customer accounts", description: "Sign-up, login and a basic account area for customers." }],
  },
  {
    key: "payments",
    label: "online payments / e-commerce",
    patterns: /\b(e-?commerce|online (shop|store)|checkout|shopping cart|sell (products|online)|accept payments)\b/i,
    hours: 12,
    deliverables: [{ title: "Online payments", description: "Product checkout with online payments." }],
  },
  {
    key: "blog",
    label: "blog",
    patterns: /\bblog\b/i,
    hours: 5,
    deliverables: [{ title: "Blog", description: "Blog listing and article page templates." }],
  },
  {
    key: "pages",
    label: "additional pages",
    patterns: /\b(another|additional|extra|more|new|second|\d+ more) pages?\b|\babout (us )?page\b|\bpricing page\b/i,
    hours: 4,
    deliverables: [{ title: "Additional page", description: "Design and build of an additional page in the existing style." }],
  },
  {
    key: "i18n",
    label: "multi-language support",
    patterns: /\b(multi-?lingual|translations?|another language|second language|spanish|french|japanese|german) (version|site)?\b/i,
    hours: 6,
    deliverables: [{ title: "Multi-language support", description: "Language switcher and translated page structure (translations supplied by the client)." }],
  },
  {
    key: "newsletter",
    label: "newsletter signup",
    patterns: /\b(newsletter|mailing list|email signup|mailchimp)\b/i,
    hours: 2,
    deliverables: [{ title: "Newsletter signup", description: "Newsletter signup form connected to the client's email platform." }],
  },
  {
    key: "chat",
    label: "live chat",
    patterns: /\b(live chat|chat ?bot|chat widget)\b/i,
    hours: 3,
    deliverables: [{ title: "Live chat", description: "Live chat widget integration." }],
  },
];

const REVISION = /\b(change the colou?r|tweak|adjust|fix|typo|swap|replace the (image|photo|text)|move the|bigger|smaller|font|revision|update the (text|copy))\b/i;

function simulateComparison(ctx: CompareContext): ScopeComparison {
  const text = ctx.requestText;
  const deliverables = ctx.scope.filter((s) => s.kind === "deliverable" || s.kind === "added");
  const exclusions = ctx.scope.filter((s) => s.kind === "exclusion");
  const found = FEATURES.filter((f) => f.patterns.test(text));
  const items: ScopeComparison["requestedItems"] = [];
  let outHours = 0;
  const outFeatures: Feature[] = [];

  for (const f of found) {
    const covering = deliverables.filter((d) => f.patterns.test(d.text));
    const excluding = exclusions.filter((e) => f.patterns.test(e.text) || e.text.toLowerCase().includes(f.key));
    if (covering.length > 0) {
      items.push({
        description: `Add ${f.label}`,
        classification: "in_scope",
        relatedScopeRefs: covering.map((c) => c.ref),
        explanation: `Covered by approved item ${covering.map((c) => c.ref).join(", ")}.`,
      });
    } else {
      outHours += f.hours;
      outFeatures.push(f);
      items.push({
        description: `Add ${f.label}`,
        classification: "out_of_scope",
        relatedScopeRefs: [...excluding.map((e) => e.ref), ...deliverables.map((d) => d.ref)],
        explanation: excluding.length
          ? `Explicitly excluded by ${excluding.map((e) => e.ref).join(", ")}, and not covered by any approved deliverable.`
          : `New functionality that none of the approved deliverables (${deliverables.map((d) => d.ref).join(", ")}) cover.`,
      });
    }
  }

  const isRevision = REVISION.test(text);
  if (found.length === 0 && isRevision) {
    items.push({
      description: "Adjustment to existing agreed work",
      classification: "in_scope",
      relatedScopeRefs: deliverables.map((d) => d.ref),
      explanation: "Reads as a refinement of an approved deliverable, which falls under the included revision rounds.",
    });
  }

  const outCount = items.filter((i) => i.classification === "out_of_scope").length;
  const inCount = items.filter((i) => i.classification === "in_scope").length;
  const classification: ScopeComparison["classification"] =
    items.length === 0 ? "unclear" : outCount === 0 ? "in_scope" : inCount === 0 ? "out_of_scope" : "partially_out_of_scope";
  const labels = outFeatures.map((f) => f.label);

  return {
    classification,
    confidence: items.length === 0 ? "low" : outFeatures.length > 0 ? "high" : "medium",
    reasoningSummary:
      items.length === 0
        ? "The request does not clearly map to any approved deliverable or known type of additional work. Clarify what is needed before deciding."
        : outFeatures.length
          ? `The request asks for ${labels.join(" and ")}, which is not covered by the approved deliverables${
              items.some((i) => i.relatedScopeRefs.some((r) => r.startsWith("E"))) ? " and matches an explicit exclusion" : ""
            }. It should be handled as a change request.`
          : "The request refines work that is already part of the approved scope.",
    requestedItems: items,
    suggestedAction: items.length === 0 ? "clarify_with_client" : outFeatures.length ? "create_change_request" : "treat_as_in_scope",
    estimatedEffortHours: outFeatures.length ? outHours : null,
    effortRationale: outFeatures.length
      ? `Typical effort for ${outFeatures.map((f) => `${f.label} (~${f.hours}h)`).join(", ")}.`
      : null,
    clarifyingQuestions:
      items.length === 0
        ? ["Could you describe the change in a bit more detail, e.g. which page and what should happen?"]
        : outFeatures.some((f) => f.key === "booking")
          ? ["Which calendar or booking tool do you use today, if any?", "Do bookings need payment at the time of booking?"]
          : [],
    draftChangeRequest: outFeatures.length
      ? {
          title: `Add ${labels.join(" and ")}`,
          description: `Additional work requested after the proposal was approved: ${labels.join(", ")}. This is outside the original agreed scope.`,
          deliverables: outFeatures.flatMap((f) => f.deliverables),
        }
      : null,
    clientReplyDraft: outFeatures.length
      ? `Thanks for the idea — a ${labels.join(" and ")} would be a great addition. It isn't part of our current agreement, so I've put together a short change request with the details and price for you to review and approve in your client portal.`
      : items.length
        ? "Thanks! That's covered by our current agreement — I'll include it in the next revision."
        : "Thanks for the message! Could you share a bit more detail so I can confirm whether this is covered by our current agreement?",
  };
}

// ───────────────────────────── timeline & finance ─────────────────────────────

export type TimelineInsightContext = {
  late: { name: string; dueDate: string }[];
  affected: string[];
  overduePayments: { milestoneTitle: string; amount: string; currency: string; dueDate: string }[];
  changes: { number: number; title: string; extendsScheduleByDays: number }[];
  endDate: string;
  baselineEndDate: string | null;
};

function simulateTimelineInsight(c: TimelineInsightContext) {
  const recs: string[] = [];
  if (c.overduePayments.length) recs.push("Send the client a friendly reminder about the overdue payment before starting dependent work.");
  if (c.late.length) recs.push("Update the client on the late phase and, if the date must move, propose a change request instead of changing it silently.");
  if (c.changes.some((x) => x.extendsScheduleByDays > 0)) recs.push("Confirm the client understands that the approved change extends the delivery date.");
  if (!recs.length) recs.push("No action needed: everything is on plan.");
  const pay = c.overduePayments[0];
  const headline = c.late.length || pay ? `${c.late.length} late phase(s), ${c.overduePayments.length} overdue payment(s)` : "On plan";
  const parts = [
    c.late.length ? `Late: ${c.late.map((l) => `${l.name} (due ${l.dueDate})`).join(", ")}.` : "No phase is late.",
    c.affected.length ? `${c.affected.length} downstream item(s) are affected.` : "",
    pay ? `${pay.milestoneTitle} (${pay.amount} ${pay.currency}) was due ${pay.dueDate}.` : "",
    `Planned finish: ${c.endDate}${c.baselineEndDate && c.baselineEndDate !== c.endDate ? ` (agreed: ${c.baselineEndDate})` : ""}.`,
  ];
  return {
    headline,
    explanation: parts.filter(Boolean).join(" "),
    recommendations: recs.slice(0, 4),
    clientMessage: pay ? `Hi! Just a quick heads-up that the ${pay.milestoneTitle.toLowerCase()} payment of ${pay.amount} ${pay.currency} was due on ${pay.dueDate}. You can pay it from your project portal whenever you're ready. Thanks!` : null,
  };
}

export type FinancialAnswerContext = { question: string; facts: { id: string; label: string; value: string }[] };

function simulateFinancialAnswer(c: FinancialAnswerContext) {
  const words = c.question.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const hits = c.facts.filter((f) => words.some((w) => f.label.toLowerCase().includes(w))).slice(0, 6);
  const used = hits.length ? hits : c.facts.slice(0, 4);
  return {
    answer: used.length ? used.map((f) => `${f.label}: ${f.value}.`).join(" ") : "There is no financial data yet.",
    citedIds: used.map((f) => f.id),
  };
}
