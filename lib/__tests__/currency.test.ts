import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/currency";

describe("formatMoney", () => {
  it("defaults to CHF when no currency is given", () => {
    expect(formatMoney(100)).toMatch(/CHF/);
  });

  it("formats USD and EUR in their own locale/symbol", () => {
    expect(formatMoney(100, "USD")).toContain("$");
    expect(formatMoney(100, "EUR")).toContain("€");
  });

  it("rounds to at most 2 decimal digits", () => {
    const out = formatMoney(19.999, "USD");
    expect(out).not.toMatch(/999/);
  });
});
