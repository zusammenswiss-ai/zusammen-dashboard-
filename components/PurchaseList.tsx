"use client";

import { Pencil, Trash2, ExternalLink } from "lucide-react";
import type { Purchase } from "@/lib/supabase/types";
import { PURCHASE_STATUS_STYLES } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/currency";

/** Renders a supplier's purchases ("Beszerzések" fül) — mirrors
 * PriceQuoteList.tsx mintáját. A csomagszám mellett egy 17track link
 * jelenik meg, NEM automatikus csomagkövető API-hívás, csak egy kézzel
 * kattintható külső link. */
export default function PurchaseList({
  purchases,
  onEdit,
  onDelete,
}: {
  purchases: Purchase[];
  onEdit: (purchase: Purchase) => void;
  onDelete: (purchase: Purchase) => void;
}) {
  if (purchases.length === 0) {
    return <p className="text-sm text-muted">Még nincs rögzített beszerzés.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {purchases.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-forest">{p.item_name}</p>
              <span className={`badge ${PURCHASE_STATUS_STYLES[p.status]}`}>{p.status}</span>
              <span className="badge bg-ivory-dim text-muted">{p.type}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {p.quantity} db
              {p.unit_price != null && ` · ${formatMoney(p.unit_price, p.currency)}/db`}
              {p.total_price != null && ` · összesen ${formatMoney(p.total_price, p.currency)}`}
              {p.order_date && ` · rendelve ${formatDate(p.order_date)}`}
            </p>
            {p.supplier_order_number && (
              <p className="mt-0.5 text-xs text-muted">Rendelésszám: {p.supplier_order_number}</p>
            )}
            {p.tracking_number && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                Csomagszám: {p.tracking_number}
                <a
                  href={`https://t.17track.net/en#nums=${encodeURIComponent(p.tracking_number)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-forest hover:underline"
                >
                  nyomon követés <ExternalLink size={11} />
                </a>
              </p>
            )}
            {(p.expected_arrival_start || p.expected_arrival_end) && (
              <p className="mt-0.5 text-xs text-muted">
                Várható érkezés: {formatDate(p.expected_arrival_start)} – {formatDate(p.expected_arrival_end)}
              </p>
            )}
            {p.actual_arrival_date && (
              <p className="mt-0.5 text-xs text-muted">Tényleges érkezés: {formatDate(p.actual_arrival_date)}</p>
            )}
            {p.notes && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.notes}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onEdit(p)}
              className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
              aria-label="Beszerzés szerkesztése"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => onDelete(p)}
              className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-red-600"
              aria-label="Beszerzés törlése"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
