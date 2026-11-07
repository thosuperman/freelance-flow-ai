import { db } from "@/lib/db";
import { Decimal, dec } from "@/lib/money";
import { financialsFor, projectDetailInclude } from "@/features/projects/service";

export type CurrencyTotals = {
  currency: string;
  approvedValue: Decimal;
  approvedChanges: Decimal;
  paid: Decimal;
  outstanding: Decimal;
  pending: Decimal;
  overdue: Decimal;
};

/** Every number on the dashboard is derived here from persisted records. Currencies are never mixed. */
export async function getDashboard(userId: string) {
  const projects = await db.project.findMany({
    where: { ownerId: userId },
    include: projectDetailInclude,
    orderBy: { updatedAt: "desc" },
  });

  const byCurrency = new Map<string, CurrencyTotals>();
  let pendingCount = 0;
  let overdueCount = 0;
  const rows = projects.map((p) => {
    const fin = financialsFor(p);
    const t = byCurrency.get(p.currency) ?? {
      currency: p.currency,
      approvedValue: new Decimal(0),
      approvedChanges: new Decimal(0),
      paid: new Decimal(0),
      outstanding: new Decimal(0),
      pending: new Decimal(0),
      overdue: new Decimal(0),
    };
    t.approvedValue = t.approvedValue.plus(fin.revisedValue);
    t.approvedChanges = t.approvedChanges.plus(fin.approvedChanges);
    t.paid = t.paid.plus(fin.paid);
    t.outstanding = t.outstanding.plus(fin.outstanding);
    t.pending = t.pending.plus(fin.pendingRequests);
    t.overdue = t.overdue.plus(fin.overdue);
    byCurrency.set(p.currency, t);
    pendingCount += fin.pendingRequestCount;
    overdueCount += fin.overdueCount;
    return { project: p, fin };
  });

  const upcoming = projects
    .filter((p) => p.status === "ACTIVE")
    .flatMap((p) => p.milestones.filter((m) => m.termsStatus === "APPROVED" && m.paymentStatus !== "PAID").map((m) => ({ m, p })))
    .sort((a, b) => (a.m.dueDate?.getTime() ?? Infinity) - (b.m.dueDate?.getTime() ?? Infinity))
    .slice(0, 6);

  const transactions = projects
    .flatMap((p) => p.paymentRequests.flatMap((pr) => pr.transactions.map((t) => ({ t, pr, p }))))
    .sort((a, b) => b.t.capturedAt.getTime() - a.t.capturedAt.getTime());

  // Monthly received (completed captures) for the primary currency, last 6 months.
  const primary = [...byCurrency.values()].sort((a, b) => b.approvedValue.comparedTo(a.approvedValue))[0]?.currency ?? null;
  const months: { key: string; label: string; total: Decimal }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), total: new Decimal(0) });
  }
  if (primary) {
    for (const { t } of transactions) {
      if (t.status !== "COMPLETED" || t.currency !== primary) continue;
      const m = months.find((x) => x.key === t.capturedAt.toISOString().slice(0, 7));
      if (m) m.total = m.total.plus(dec(t.amount));
    }
  }

  return {
    rows,
    totals: [...byCurrency.values()],
    activeCount: projects.filter((p) => p.status === "ACTIVE").length,
    awaitingApproval: projects.filter((p) => p.status === "PROPOSED").length,
    pendingCount,
    overdueCount,
    upcoming,
    recentTransactions: transactions.slice(0, 6),
    monthly: primary ? { currency: primary, months } : null,
  };
}
