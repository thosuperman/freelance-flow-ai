import { describe, expect, it } from "vitest";
import {
  dec,
  formatMoney,
  parseMoney,
  percentOf,
  splitByPercentages,
  sum,
  toAmountString,
  totalsByCurrency,
} from "@/lib/money";

describe("money", () => {
  it("avoids floating point errors", () => {
    expect(sum(["0.1", "0.2"]).toString()).toBe("0.3");
    expect(toAmountString(sum(["19.99", "0.01", "80"]), "USD")).toBe("100.00");
  });

  it("computes the 30% deposit of $1,500 exactly", () => {
    expect(toAmountString(percentOf("1500", 30, "USD"), "USD")).toBe("450.00");
  });

  it("splits by percentages and assigns rounding residue to the last part", () => {
    const parts = splitByPercentages("1500", [30, 70], "USD").map((d) => toAmountString(d, "USD"));
    expect(parts).toEqual(["450.00", "1050.00"]);
    const thirds = splitByPercentages("100", ["33.3333", "33.3333", "33.3334"], "USD");
    expect(sum(thirds).toFixed(2)).toBe("100.00");
    expect(thirds.map((d) => d.toFixed(2))).toEqual(["33.33", "33.33", "33.34"]);
  });

  it("rejects percentages that do not total 100", () => {
    expect(() => splitByPercentages("100", [30, 60], "USD")).toThrow(/100/);
  });

  it("respects zero-decimal currencies", () => {
    expect(toAmountString("1000.4", "JPY")).toBe("1000");
    expect(parseMoney("1000.5", "JPY")).toBeNull();
    expect(toAmountString(splitByPercentages("10000", [33, 67], "JPY")[0]!, "JPY")).toBe("3300");
  });

  it("parses user input strictly", () => {
    expect(parseMoney("1,500.00", "USD")?.toString()).toBe("1500");
    expect(parseMoney("10.005", "USD")).toBeNull();
    expect(parseMoney("-5", "USD")).toBeNull();
    expect(parseMoney("abc", "USD")).toBeNull();
  });

  it("formats with currency symbols", () => {
    expect(formatMoney("1350", "USD")).toBe("$1,350.00");
    expect(formatMoney("1350", "JPY")).toBe("¥1,350");
  });

  it("never mixes currencies when totalling", () => {
    const totals = totalsByCurrency([
      { amount: "100", currency: "USD" },
      { amount: "50", currency: "EUR" },
      { amount: dec("25.50"), currency: "USD" },
    ]);
    expect(totals.get("USD")?.toString()).toBe("125.5");
    expect(totals.get("EUR")?.toString()).toBe("50");
  });
});
