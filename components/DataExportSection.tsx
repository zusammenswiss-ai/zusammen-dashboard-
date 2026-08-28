"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Download } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ANON_TABLE_NAMES } from "@/lib/supabase/types";
import { toCSV } from "@/lib/csv";
import { ErrorBanner } from "@/components/Feedback";

/** Any table row — the shape varies per table, which is exactly why this stays untyped here. */
type Row = Record<string, unknown>;

function cellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value); // jsonb columns (products, box_items, …)
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function rowsToCsv(rows: Row[]): string {
  const headers = Object.keys(rows[0]);
  return toCSV(
    headers,
    rows.map((row) => headers.map((h) => cellValue(row[h])))
  );
}

/**
 * "Minden adat exportálása" — every anon-accessible table (see
 * lib/supabase/types.ts's ANON_TABLE_NAMES), each as its own CSV, all
 * zipped client-side (jszip, already a dependency for the Kártya-fájlok
 * folder-zip flow) into one download. No new API route: this is the
 * exact same anon-key read access the rest of the dashboard already has
 * from the browser, just looped over every table instead of one.
 */
export default function DataExportSection() {
  const supabase = getSupabaseClient();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  async function exportAll() {
    if (!supabase) return;
    setExporting(true);
    setError(null);
    setSkipped([]);
    try {
      const zip = new JSZip();
      const emptyTables: string[] = [];
      for (const table of ANON_TABLE_NAMES) {
        const { data, error: queryError } = await supabase.from(table).select("*");
        if (queryError) throw new Error(`${table}: ${queryError.message}`);
        const rows = (data ?? []) as Row[];
        if (rows.length === 0) {
          emptyTables.push(table);
          continue;
        }
        zip.file(`${table}.csv`, rowsToCsv(rows));
      }
      if (emptyTables.length > 0) {
        zip.file(
          "README.txt",
          `Üres táblák (nincs bennük sor, ezért nincs .csv fájljuk):\n${emptyTables.join("\n")}\n`
        );
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zusammen-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setSkipped(emptyTables);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült exportálni az adatokat.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Download size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Adatexport</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Minden Supabase-tábla egy-egy CSV fájlként, egy ZIP-be csomagolva — teljes biztonsági mentés egy kattintással.
      </p>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <button type="button" onClick={exportAll} disabled={exporting} className="btn btn-primary mt-4 w-fit">
        <Download size={15} /> {exporting ? "Exportálás…" : "Minden adat exportálása"}
      </button>

      {skipped.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {skipped.length} tábla üres volt, azok kimaradtak a ZIP-ből (részletek a benne lévő README.txt-ben).
        </p>
      )}
    </div>
  );
}
