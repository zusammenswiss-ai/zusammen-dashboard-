// "Teljes pénzügyi export" — the one multi-sheet .xlsx download that's
// meant to be handed straight to a könyvelő (accountant), unlike the
// per-section CSV exports (lib/csv.ts) which stay one flat table each.
// Uses the `xlsx` (SheetJS community edition) package, client-side only
// — same "build a Blob, click a hidden <a>" pattern as downloadCSV.
import * as XLSX from "xlsx";

export type XlsxSheet = {
  name: string; // Excel sheet-tab name — SheetJS truncates/sanitizes if needed
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
};

export function downloadXLSX(filename: string, sheets: XlsxSheet[]) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    // Excel sheet names: max 31 chars, no []:*?/\\.
    const safeName = sheet.name.replace(/[[\]:*?/\\]/g, "").slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }
  const buffer: ArrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
