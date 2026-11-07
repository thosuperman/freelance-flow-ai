import Decimal from "decimal.js";
import { formatMoney } from "@/lib/money";

/** Payments received per month, from completed PayPal captures only. */
export function MonthlyChart({ currency, months }: { currency: string; months: { label: string; value: string }[] }) {
  const values = months.map((m) => new Decimal(m.value));
  const max = Decimal.max(...values, new Decimal(0));
  const hasData = !max.isZero();
  return (
    <figure className="rounded-2xl border bg-card p-4 shadow-xs">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Payments received</span>
        <span className="text-xs text-muted-foreground">Last 6 months · {currency}</span>
      </figcaption>
      {hasData ? (
        <div className="flex h-36 items-end gap-3" role="img" aria-label={`Payments received per month in ${currency}`}>
          {months.map((m, i) => {
            const pct = max.isZero() ? 0 : values[i]!.dividedBy(max).times(100).toNumber();
            return (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground tabular">{values[i]!.isZero() ? "" : formatMoney(m.value, currency).replace(/\.00$/, "")}</span>
                <div className="flex h-24 w-full items-end">
                  <div className="w-full rounded-t-md bg-primary/85" style={{ height: `${Math.max(pct, values[i]!.isZero() ? 0 : 4)}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-xs text-muted-foreground">No completed payments yet — this chart fills in from verified PayPal captures.</p>
      )}
      <table className="sr-only">
        <tbody>
          {months.map((m) => (
            <tr key={m.label}>
              <th>{m.label}</th>
              <td>{formatMoney(m.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
