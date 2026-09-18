"use client";

import { FileSpreadsheet, Info } from "lucide-react";
import type { Budget, Expense, Revenue } from "@/lib/supabase/types";
import { downloadXLSX, type XlsxSheet } from "@/lib/xlsx-export";

/**
 * Export — a per-szekciós CSV export gombok (Fix/Változó költségek,
 * Bevételek fülön, a szűrt/látható sorokra) mellett itt van az egyben,
 * több munkalapos "Teljes pénzügyi export" — ez az, amit egy
 * könyvelőnek át lehet adni. Mindig a teljes (nem szűrt) adatot
 * tartalmazza, hiszen ide szándékosan nem hozott magával szűrőt egyik
 * fül sem.
 */
export default function ExportTab({ expenses, revenue, budgets }: { expenses: Expense[]; revenue: Revenue[]; budgets: Budget[] }) {
  function exportAll() {
    const sheets: XlsxSheet[] = [
      {
        name: "Fix költségek",
        headers: ["Dátum", "Kategória", "Leírás", "Összeg", "Pénznem", "Ismétlődő", "Gyakoriság", "Fizetési mód", "Megjegyzés"],
        rows: expenses
          .filter((e) => e.type === "Fix költség")
          .map((e) => [
            e.expense_date,
            e.category,
            e.description,
            e.amount,
            e.currency,
            e.is_recurring ? "igen" : "nem",
            e.recurrence_type ?? "",
            e.payment_method ?? "",
            e.notes ?? "",
          ]),
      },
      {
        name: "Változó költségek",
        headers: ["Dátum", "Kategória", "Leírás", "Összeg", "Pénznem", "Fizetési mód", "Megjegyzés"],
        rows: expenses
          .filter((e) => e.type === "Változó költség")
          .map((e) => [e.expense_date, e.category, e.description, e.amount, e.currency, e.payment_method ?? "", e.notes ?? ""]),
      },
      {
        name: "Bevételek",
        headers: ["Dátum", "Forrás", "Összeg", "Pénznem", "Státusz", "Megjegyzés"],
        rows: revenue.map((r) => [r.revenue_date, r.source, r.amount, r.currency, r.status ?? "", r.notes ?? ""]),
      },
      {
        name: "Költségvetés",
        headers: ["Kategória", "Időszak", "Év", "Hónap", "Negyedév", "Tervezett összeg", "Pénznem"],
        rows: budgets.map((b) => [b.category, b.period, b.year, b.month ?? "", b.quarter ?? "", b.planned_amount, b.currency]),
      },
    ];
    downloadXLSX(`zusammen-penzugyek-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets);
  }

  const totalRows = expenses.length + revenue.length + budgets.length;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={16} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Teljes pénzügyi export</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Egy .xlsx fájl, négy munkalappal (Fix költségek, Változó költségek, Bevételek, Költségvetés) — ez az,
        amit egy könyvelőnek átadhatsz. A per-szekciós CSV exportok (a látható, esetlegesen szűrt sorokra) a
        Fix/Változó költségek és a Bevételek fülön, a lista tetején találhatók.
      </p>
      {totalRows === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Info size={14} /> Még nincs exportálható adat.
        </p>
      ) : (
        <button className="btn btn-bronze mt-4" onClick={exportAll}>
          <FileSpreadsheet size={16} /> Teljes pénzügyi export letöltése (.xlsx)
        </button>
      )}
    </div>
  );
}
