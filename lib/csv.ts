// Tiny CSV export helper shared by the "Exportálás CSV-be" buttons.
// Pairs with the CSV import parser already in the Suppliers page.

type CsvValue = string | number | boolean | null | undefined;

function escapeCell(value: CsvValue): string {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function downloadCSV(filename: string, csvText: string) {
  // Leading BOM so Excel opens UTF-8 files (accented Hungarian text) correctly.
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
