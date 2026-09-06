import { describe, expect, it } from "vitest";
import { toCSV } from "@/lib/csv";

describe("toCSV", () => {
  it("joins headers and rows with CRLF and a trailing CRLF", () => {
    const csv = toCSV(["name", "qty"], [["Alma", 3]]);
    expect(csv).toBe("name,qty\r\nAlma,3\r\n");
  });

  it("quotes and escapes cells containing commas, quotes or newlines", () => {
    const csv = toCSV(["note"], [['Says "hi", then\nleaves']]);
    expect(csv).toBe('note\r\n"Says ""hi"", then\nleaves"\r\n');
  });

  it("renders null/undefined cells as empty strings, not the literal text", () => {
    const csv = toCSV(["a", "b"], [[null, undefined]]);
    expect(csv).toBe("a,b\r\n,\r\n");
  });

  it("handles multiple rows and mixed cell types", () => {
    const csv = toCSV(["name", "active"], [
      ["Elso", true],
      ["Masodik", false],
    ]);
    expect(csv).toBe("name,active\r\nElso,true\r\nMasodik,false\r\n");
  });
});
