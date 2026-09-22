"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { CollectionCard } from "@/lib/supabase/types";
import { auditCardNumbers } from "@/lib/card-number-audit";

/** Kollekciónkénti sorszám-áttekintés — duplikált vagy hiányzó
 * (kategóriánként réses numerikus) azonosítók kompakt listája, hogy
 * egy pillantással látszódjon, ha valamit el kellene nevezni/pótolni.
 * Lásd lib/card-number-audit.ts a pontos logikáért. */
export default function CardNumberAudit({ cards }: { cards: CollectionCard[] }) {
  if (cards.length === 0) return null;
  const { duplicates, gaps } = auditCardNumbers(cards);
  const cardById = new Map(cards.map((c) => [c.id, c]));

  if (duplicates.length === 0 && gaps.length === 0) {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-xs text-forest">
        <CheckCircle2 size={13} /> Nincs duplikált vagy hiányzó sorszám.
      </p>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {duplicates.map((d) => (
        <p key={d.card_number} className="flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Duplikált sorszám: <strong>{d.card_number}</strong> —{" "}
            {d.cardIds
              .map((id) => cardById.get(id))
              .filter((c): c is CollectionCard => Boolean(c))
              .map((c) => c.card_type)
              .join(", ")}
          </span>
        </p>
      ))}
      {gaps.map((g) => (
        <p key={`${g.card_type}::${g.suit ?? ""}`} className="flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Hiányzó sorszám{g.missing.length > 1 ? "ok" : ""} — {g.card_type}
            {g.suit ? ` (${g.suit})` : ""}: <strong>{g.missing.join(", ")}</strong>
          </span>
        </p>
      ))}
    </div>
  );
}
