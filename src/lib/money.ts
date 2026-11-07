import Decimal from "decimal.js";

/**
 * Exact, currency-aware money helpers.
 *
 * Authoritative amounts are always Decimal (backed by Postgres DECIMAL(14,2)), never JS floats.
 * Currencies with zero minor units (e.g. JPY) are rounded to whole units, which is also what
 * PayPal requires for those currencies.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const MINOR_UNITS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  JPY: 0,
  SGD: 2,
};

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export function assertCurrency(code: string): CurrencyCode {
  const upper = code.toUpperCase();
  if (!isSupportedCurrency(upper)) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return upper;
}

export function minorUnits(currency: string): number {
  return MINOR_UNITS[assertCurrency(currency)];
}

export type MoneyInput = Decimal | string | number | { toString(): string };

/** Converts any supported input (Prisma Decimal, string, integer) into a decimal.js Decimal. */
export function dec(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid amount");
    // Numbers are only accepted when they came from trusted integer-ish sources; normalise via string.
    return new Decimal(value.toString());
  }
  const s = value.toString().trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid amount: ${value.toString()}`);
  return new Decimal(s);
}

/** Rounds to the currency's minor unit. */
export function roundMoney(value: MoneyInput, currency: string): Decimal {
  return dec(value).toDecimalPlaces(minorUnits(currency), Decimal.ROUND_HALF_UP);
}

/** Parses user input into a positive money amount; returns null when invalid. */
export function parseMoney(input: string, currency: string): Decimal | null {
  try {
    const d = dec(input);
    if (d.isNegative()) return null;
    // Reject more precision than the currency allows (e.g. 10.005 USD, 10.5 JPY).
    if (d.decimalPlaces() > minorUnits(currency)) return null;
    if (d.greaterThan("999999999999")) return null;
    return roundMoney(d, currency);
  } catch {
    return null;
  }
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

/** String form suitable for storage and APIs, e.g. "1500.00" (USD) or "1500" (JPY). */
export function toAmountString(value: MoneyInput, currency: string): string {
  return roundMoney(value, currency).toFixed(minorUnits(currency));
}

/** PayPal expects a string value with exactly the currency's minor-unit digits. */
export const toPayPalValue = toAmountString;

export function percentOf(total: MoneyInput, percent: MoneyInput, currency: string): Decimal {
  return roundMoney(dec(total).times(dec(percent)).dividedBy(100), currency);
}

/**
 * Splits a total into parts by percentage. Rounding residue is assigned to the last part,
 * so the parts always sum exactly to the total.
 */
export function splitByPercentages(
  total: MoneyInput,
  percentages: MoneyInput[],
  currency: string,
): Decimal[] {
  if (percentages.length === 0) return [];
  const pctSum = sum(percentages);
  if (!pctSum.equals(100)) {
    throw new Error(`Percentages must add up to 100 (got ${pctSum.toString()})`);
  }
  const t = roundMoney(total, currency);
  const parts = percentages.slice(0, -1).map((p) => percentOf(t, p, currency));
  const last = t.minus(sum(parts));
  return [...parts, last];
}

export function formatMoney(value: MoneyInput, currency: string, locale = "en-US"): string {
  const code = assertCurrency(currency);
  const digits = MINOR_UNITS[code];
  // Intl formatting is display-only; the number passed here is never used for arithmetic.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(roundMoney(value, code).toFixed(digits)));
}

/** Groups amounts by currency without ever mixing currencies. */
export function totalsByCurrency(
  rows: { amount: MoneyInput; currency: string }[],
): Map<string, Decimal> {
  const map = new Map<string, Decimal>();
  for (const row of rows) {
    const prev = map.get(row.currency) ?? new Decimal(0);
    map.set(row.currency, prev.plus(dec(row.amount)));
  }
  return map;
}

export { Decimal };
