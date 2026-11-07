import { formatMoney, type MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Money({ value, currency, className }: { value: MoneyInput; currency: string; className?: string }) {
  return <span className={cn("tabular whitespace-nowrap", className)}>{formatMoney(value, currency)}</span>;
}
