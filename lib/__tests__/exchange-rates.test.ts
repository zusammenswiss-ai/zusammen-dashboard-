import { describe, expect, it } from "vitest";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";

// "1 CHF equals this many units of X" — CHF is the pivot (see the
// module's own comment).
const RATES: ExchangeRates = { CHF: 1, USD: 1.1, EUR: 0.95 };

describe("convertAmount", () => {
  it("returns the amount unchanged when from === to, even with null rates", () => {
    expect(convertAmount(50, "USD", "USD", null)).toBe(50);
    expect(convertAmount(50, "USD", "USD", RATES)).toBe(50);
  });

  it("returns the amount unchanged when rates are null (fetch failed/not loaded)", () => {
    expect(convertAmount(50, "USD", "CHF", null)).toBe(50);
  });

  it("converts from CHF to another currency by multiplying", () => {
    expect(convertAmount(10, "CHF", "USD", RATES)).toBeCloseTo(11, 5);
  });

  it("converts from another currency to CHF by dividing", () => {
    expect(convertAmount(11, "USD", "CHF", RATES)).toBeCloseTo(10, 5);
  });

  it("converts between two non-CHF currencies via the CHF pivot", () => {
    // 11 USD -> 10 CHF -> 9.5 EUR
    expect(convertAmount(11, "USD", "EUR", RATES)).toBeCloseTo(9.5, 5);
  });
});
