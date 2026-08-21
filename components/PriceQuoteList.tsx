"use client";

import { Star, Trash2, ImageIcon } from "lucide-react";
import type { PriceQuote } from "@/lib/supabase/types";
import { formatDate } from "@/lib/format";

function formatMoney(amount: number, currency: string | null) {
  return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
}

/**
 * Renders a set of price_quotes rows — used both on a card-asset's detail
 * (mode "card", each row labeled by supplier) and on a supplier's profile
 * (mode "supplier", each row labeled by card version). The accepted quote
 * (is_selected) gets a green ring; toggling selection on any other quote
 * for the same card asset is handled by the caller (only one quote per
 * asset should end up selected).
 */
export default function PriceQuoteList({
  quotes,
  mode,
  supplierNameById,
  cardAssetLabelById,
  onToggleSelected,
  onDelete,
}: {
  quotes: PriceQuote[];
  mode: "card" | "supplier";
  supplierNameById?: Map<string, string>;
  cardAssetLabelById?: Map<string, string>;
  onToggleSelected: (quote: PriceQuote) => void;
  onDelete: (quote: PriceQuote) => void;
}) {
  if (quotes.length === 0) {
    return <p className="text-sm text-muted">Még nincs rögzített árajánlat.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {quotes.map((q) => {
        const label =
          mode === "card"
            ? (q.supplier_id && supplierNameById?.get(q.supplier_id)) || "Ismeretlen beszállító"
            : (cardAssetLabelById?.get(q.card_asset_id) ?? "Ismeretlen kártya-verzió");
        return (
          <div
            key={q.id}
            className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${
              q.is_selected ? "border-green-500 ring-1 ring-green-500" : "border-border"
            }`}
          >
            {q.screenshot_url && (
              <a
                href={q.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-14 w-14 shrink-0 overflow-hidden rounded-md bg-ivory-dim"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.screenshot_url} alt="Árajánlat kép" className="h-full w-full object-cover" />
              </a>
            )}
            {!q.screenshot_url && (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-ivory-dim text-muted/40">
                <ImageIcon size={16} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-forest">{label}</p>
                {q.is_selected && <span className="badge bg-green-100 text-green-700">Kiválasztva</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {q.quantity} db
                {q.unit_price != null && ` · ${formatMoney(q.unit_price, q.currency)}/db`}
                {q.total_price != null && ` · összesen ${formatMoney(q.total_price, q.currency)}`}
                {" · "}
                {formatDate(q.quote_date)}
              </p>
              {q.notes && <p className="mt-1 line-clamp-2 text-xs text-muted">{q.notes}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => onToggleSelected(q)}
                className={`rounded-md p-1.5 ${
                  q.is_selected
                    ? "text-green-600 hover:bg-green-50"
                    : "text-muted hover:bg-ivory-dim hover:text-forest"
                }`}
                aria-label={q.is_selected ? "Kiválasztás visszavonása" : "Megjelölés elfogadottként"}
                title={q.is_selected ? "Kiválasztás visszavonása" : "Megjelölés elfogadottként"}
              >
                <Star size={16} fill={q.is_selected ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => onDelete(q)}
                className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-red-600"
                aria-label="Árajánlat törlése"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
