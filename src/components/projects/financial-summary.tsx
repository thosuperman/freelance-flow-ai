import { Stat } from "@/components/shared/stat";
import { Money } from "@/components/shared/money";
import type { financialsFor } from "@/features/projects/service";

type Fin = ReturnType<typeof financialsFor>;

export function FinancialSummary({ fin, currency }: { fin: Fin; currency: string }) {
  return (
    <section aria-label="Project financials" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="project-financials">
        <Stat label="Original contract" value={<Money value={fin.originalValue} currency={currency} />} hint={fin.hasApprovedAgreement ? "Approved proposal" : "Not approved yet"} />
        <Stat label="Approved changes" value={<Money value={fin.approvedChanges} currency={currency} />} hint="Change requests" tone={fin.approvedChanges.isZero() ? "default" : "brand"} />
        <Stat label="Revised project value" value={<Money value={fin.revisedValue} currency={currency} />} />
        <Stat label="Payments received" value={<Money value={fin.paid} currency={currency} />} hint="Verified PayPal captures" tone="success" />
        <Stat
          label="Outstanding"
          value={<Money value={fin.outstanding} currency={currency} />}
          hint={fin.pendingRequestCount ? `${fin.pendingRequestCount} request(s) open` : fin.overdueCount ? `${fin.overdueCount} overdue` : undefined}
          tone={fin.overdueCount ? "danger" : "default"}
          className="col-span-2 md:col-span-1"
        />
      </div>
      {fin.reconciliationDiff && !fin.reconciliationDiff.isZero() ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          Reconciliation warning: approved milestones differ from the revised project value by <Money value={fin.reconciliationDiff} currency={currency} />.
        </p>
      ) : null}
    </section>
  );
}
