import { describe, expect, it } from "vitest";
import { formatCHF, formatDate, timeAgo } from "@/lib/format";

describe("formatCHF", () => {
  it("formats a number as a Swiss-locale CHF amount", () => {
    // de-CH uses a right single quote as the thousands separator and a
    // non-breaking space before the symbol — assert on the digits/currency
    // rather than exact whitespace, which can vary across ICU versions.
    const out = formatCHF(1234.5);
    expect(out).toContain("1");
    expect(out).toContain("234");
    expect(out).toContain("50");
    expect(out).toMatch(/CHF/);
  });
});

describe("formatDate", () => {
  it("renders a valid ISO date in hu-HU short format", () => {
    expect(formatDate("2026-03-15")).toMatch(/2026/);
  });

  it("returns an em dash for null, undefined or an invalid date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("timeAgo", () => {
  it("says 'éppen most' for anything under 5 seconds old", () => {
    expect(timeAgo(new Date().toISOString())).toBe("éppen most");
  });

  it("renders minutes for something a few minutes old", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(timeAgo(tenMinutesAgo)).toBe("10 perce");
  });

  it("renders days for something several days old", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe("3 napja");
  });
});
