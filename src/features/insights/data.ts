import "server-only";
import { db } from "@/lib/db";
import { Decimal, dec, toAmountString } from "@/lib/money";
import { financialsFor, projectDetailInclude, type ProjectDetail } from "@/features/projects/service";

/**
 * Financial Intelligence dataset: flat, related tables for AG Studio, built only from the signed-in
 * freelancer's own records. Authoritative money math uses decimal.js via financialsFor (the same
 * numbers as the project pages and dashboard); the values handed to Studio are numbers for display
 * and charting. Currencies are never combined: every row carries its currency, and the per-currency
 * facts below are computed separately for each one.
 */

const DAY = 86_400_000;
const num = (d: Decimal | string | { toString(): string }) => Number(dec(d.toString()).toFixed(2));
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export type FinancialDataset = Awaited<ReturnType<typeof buildFinancialDataset>>;

export function datasetFromProjects(projects: ProjectDetail[], now = new Date()) {
  const clients = new Map<string, { id: string; name: string; company: string }>();
  const projectRows = [];
  const milestoneRows = [];
  const requestRows = [];
  const transactionRows = [];
  const changeRows = [];
  const totals = new Map<string, { contracted: Decimal; changes: Decimal; paid: Decimal; outstanding: Decimal; overdue: Decimal; pendingChanges: Decimal; projects: number }>();

  for (const p of projects) {
    clients.set(p.client.id, { id: p.client.id, name: p.client.name, company: p.client.company ?? "" });
    const fin = financialsFor(p);
    const t = totals.get(p.currency) ?? { contracted: dec(0), changes: dec(0), paid: dec(0), outstanding: dec(0), overdue: dec(0), pendingChanges: dec(0), projects: 0 };
    t.contracted = t.contracted.plus(fin.revisedValue);
    t.changes = t.changes.plus(fin.approvedChanges);
    t.paid = t.paid.plus(fin.paid);
    t.outstanding = t.outstanding.plus(fin.outstanding);
    t.overdue = t.overdue.plus(fin.overdue);
    t.projects += 1;

    projectRows.push({
      id: p.id,
      title: p.title,
      clientId: p.client.id,
      currency: p.currency,
      status: p.status,
      createdAt: day(p.createdAt),
      originalValue: num(fin.originalValue),
      approvedChanges: num(fin.approvedChanges),
      revisedValue: num(fin.revisedValue),
      paid: num(fin.paid),
      outstanding: num(fin.outstanding),
      overdue: num(fin.overdue),
      paidShare: fin.revisedValue.gt(0) ? Number(fin.paid.div(fin.revisedValue).toFixed(4)) : 0,
    });

    for (const m of p.milestones) {
      milestoneRows.push({
        id: m.id,
        projectId: p.id,
        title: m.title,
        kind: m.kind === "CHANGE_ORDER" ? "Change order" : m.kind === "DEPOSIT" ? "Deposit" : "Delivery",
        currency: m.currency,
        amount: num(m.amount),
        dueDate: day(m.dueDate),
        terms: m.termsStatus,
        workStatus: m.workStatus,
        paymentStatus: m.paymentStatus,
      });
    }

    for (const r of p.paymentRequests) {
      const open = r.status === "OPEN" || r.status === "PROCESSING";
      const overdueDays = open ? Math.max(0, Math.floor((now.getTime() - r.dueDate.getTime()) / DAY)) : 0;
      requestRows.push({
        id: r.id,
        projectId: p.id,
        milestoneId: r.milestoneId,
        description: r.description,
        currency: r.currency,
        amount: num(r.amount),
        status: r.status,
        dueDate: day(r.dueDate),
        paidAt: day(r.paidAt),
        isOverdue: open && r.dueDate.getTime() < now.getTime(),
        daysOverdue: overdueDays,
        daysToPay: r.paidAt ? Math.max(0, Math.round((r.paidAt.getTime() - r.createdAt.getTime()) / DAY)) : null,
      });
      for (const tx of r.transactions) {
        transactionRows.push({
          id: tx.id,
          projectId: p.id,
          paymentRequestId: r.id,
          captureId: tx.providerCaptureId,
          environment: tx.environment,
          currency: tx.currency,
          amount: num(tx.amount),
          status: tx.status,
          capturedAt: day(tx.capturedAt ?? tx.createdAt),
          verifiedVia: tx.verifiedVia,
        });
      }
    }

    for (const c of p.changeRequests) {
      if (c.status === "PENDING_CLIENT") t.pendingChanges = t.pendingChanges.plus(c.amount);
      changeRows.push({
        id: c.id,
        projectId: p.id,
        number: c.number,
        title: c.title,
        status: c.status,
        currency: c.currency,
        amount: num(c.amount),
        approvedAmount: c.status === "APPROVED" ? num(c.amount) : 0,
        createdAt: day(c.createdAt),
        decidedAt: day(c.decidedAt),
      });
    }
    totals.set(p.currency, t);
  }

  // Per-currency facts for AI explanations. Every value is computed here, never by the model.
  const facts = [...totals.entries()].flatMap(([cur, t]) => [
    { id: `${cur}:contracted`, label: `Contracted value (${cur}, approved agreements incl. changes)`, value: `${toAmountString(t.contracted, cur)} ${cur}` },
    { id: `${cur}:changes`, label: `Approved scope-change revenue (${cur})`, value: `${toAmountString(t.changes, cur)} ${cur}` },
    { id: `${cur}:pending-changes`, label: `Change requests awaiting client approval (${cur})`, value: `${toAmountString(t.pendingChanges, cur)} ${cur}` },
    { id: `${cur}:paid`, label: `Verified PayPal payments received (${cur})`, value: `${toAmountString(t.paid, cur)} ${cur}` },
    { id: `${cur}:outstanding`, label: `Outstanding balance (${cur})`, value: `${toAmountString(t.outstanding, cur)} ${cur}` },
    { id: `${cur}:overdue`, label: `Overdue payment requests (${cur})`, value: `${toAmountString(t.overdue, cur)} ${cur}` },
  ]);
  for (const r of requestRows.filter((x) => x.isOverdue)) {
    const p = projectRows.find((x) => x.id === r.projectId)!;
    facts.push({ id: r.id, label: `Overdue: ${r.description} on "${p.title}" (due ${r.dueDate}, ${r.daysOverdue} days late)`, value: `${r.amount.toFixed(2)} ${r.currency}` });
  }
  for (const p of [...projectRows].sort((a, b) => b.outstanding - a.outstanding).slice(0, 5)) {
    facts.push({ id: p.id, label: `Outstanding on "${p.title}"`, value: `${p.outstanding.toFixed(2)} ${p.currency}` });
  }
  const month = now.toISOString().slice(0, 7);
  for (const r of requestRows.filter((x) => (x.status === "OPEN" || x.status === "PROCESSING") && x.dueDate?.startsWith(month))) {
    facts.push({ id: `due:${r.id}`, label: `Expected this month: ${r.description} (due ${r.dueDate})`, value: `${r.amount.toFixed(2)} ${r.currency}` });
  }

  return {
    asOf: now.toISOString(),
    currencies: [...totals.keys()].sort(),
    clients: [...clients.values()],
    projects: projectRows,
    milestones: milestoneRows,
    paymentRequests: requestRows,
    transactions: transactionRows,
    changeRequests: changeRows,
    facts,
  };
}

/** Owner-scoped: only the signed-in freelancer's projects are read. */
export async function buildFinancialDataset(userId: string, now = new Date()) {
  const projects = await db.project.findMany({ where: { ownerId: userId }, include: projectDetailInclude, orderBy: { createdAt: "asc" } });
  return datasetFromProjects(projects, now);
}
