import { Decimal, dec, roundMoney, sum, type MoneyInput } from "@/lib/money";

/**
 * Project financials are *derived*, never stored as editable totals:
 *   original  = total of the approved (immutable) proposal version
 *   changes   = sum of APPROVED change requests
 *   revised   = original + changes
 *   paid      = sum of COMPLETED PayPal captures (verified server-side)
 *   outstanding = revised − paid
 */
export type FinancialInputs = {
  currency: string;
  approvedProposalTotal: MoneyInput | null;
  approvedChangeRequests: { amount: MoneyInput }[];
  completedTransactions: { amount: MoneyInput; currency: string }[];
  openPaymentRequests: { amount: MoneyInput; dueDate: Date }[];
  now?: Date;
};

export type ProjectFinancials = {
  currency: string;
  originalValue: Decimal;
  approvedChanges: Decimal;
  revisedValue: Decimal;
  paid: Decimal;
  outstanding: Decimal;
  pendingRequests: Decimal;
  pendingRequestCount: number;
  overdue: Decimal;
  overdueCount: number;
  hasApprovedAgreement: boolean;
};

export function computeProjectFinancials(input: FinancialInputs): ProjectFinancials {
  const { currency } = input;
  const now = input.now ?? new Date();
  for (const t of input.completedTransactions) {
    if (t.currency !== currency) {
      // Never silently combine currencies. A mismatch indicates corrupted data.
      throw new Error(`Transaction currency ${t.currency} does not match project currency ${currency}`);
    }
  }
  const originalValue = input.approvedProposalTotal == null ? new Decimal(0) : dec(input.approvedProposalTotal);
  const approvedChanges = sum(input.approvedChangeRequests.map((c) => c.amount));
  const revisedValue = originalValue.plus(approvedChanges);
  const paid = sum(input.completedTransactions.map((t) => t.amount));
  const overdueRows = input.openPaymentRequests.filter((r) => r.dueDate.getTime() < now.getTime());
  return {
    currency,
    originalValue: roundMoney(originalValue, currency),
    approvedChanges: roundMoney(approvedChanges, currency),
    revisedValue: roundMoney(revisedValue, currency),
    paid: roundMoney(paid, currency),
    outstanding: roundMoney(Decimal.max(revisedValue.minus(paid), 0), currency),
    pendingRequests: roundMoney(sum(input.openPaymentRequests.map((r) => r.amount)), currency),
    pendingRequestCount: input.openPaymentRequests.length,
    overdue: roundMoney(sum(overdueRows.map((r) => r.amount)), currency),
    overdueCount: overdueRows.length,
    hasApprovedAgreement: input.approvedProposalTotal != null,
  };
}

/**
 * Reconciliation check: approved milestones must sum exactly to the revised project value.
 * Returns the difference (0 when consistent).
 */
export function milestoneReconciliation(
  revisedValue: MoneyInput,
  approvedMilestoneAmounts: MoneyInput[],
  currency: string,
): Decimal {
  return roundMoney(dec(revisedValue).minus(sum(approvedMilestoneAmounts)), currency);
}
