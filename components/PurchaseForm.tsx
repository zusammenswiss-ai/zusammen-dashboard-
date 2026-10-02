"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CurrencyCode, Purchase, PurchaseStatus, PurchaseType } from "@/lib/supabase/types";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import { errorMessage } from "@/lib/errors";

const TYPES: PurchaseType[] = ["Minta", "Készlet", "Csomagolóanyag", "Egyéb"];
const STATUSES: PurchaseStatus[] = ["Megrendelve", "Gyártás alatt", "Úton", "Megérkezett", "Jóváhagyva", "Elutasítva"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toDraft(purchase: Purchase | null) {
  return {
    item_name: purchase?.item_name ?? "",
    type: purchase?.type ?? ("Minta" as PurchaseType),
    quantity: purchase ? String(purchase.quantity) : "1",
    unit_price: purchase?.unit_price != null ? String(purchase.unit_price) : "",
    total_price: purchase?.total_price != null ? String(purchase.total_price) : "",
    currency: purchase?.currency ?? ("CHF" as CurrencyCode),
    supplier_order_number: purchase?.supplier_order_number ?? "",
    order_date: purchase?.order_date ?? todayISO(),
    status: purchase?.status ?? ("Megrendelve" as PurchaseStatus),
    tracking_number: purchase?.tracking_number ?? "",
    shipped_date: purchase?.shipped_date ?? "",
    expected_arrival_start: purchase?.expected_arrival_start ?? "",
    expected_arrival_end: purchase?.expected_arrival_end ?? "",
    actual_arrival_date: purchase?.actual_arrival_date ?? "",
    notes: purchase?.notes ?? "",
  };
}

/** "+ Új beszerzés" / szerkesztés form egy beszállító "Beszerzések"
 * füléhez — mirrors PriceQuoteForm.tsx mintáját: önállóan ment
 * Supabase-be, és a kész rekorddal tér vissza a hívónak. */
export default function PurchaseForm({
  supplierId,
  purchase,
  onSaved,
  onCancel,
}: {
  supplierId: string;
  purchase?: Purchase;
  onSaved: (purchase: Purchase) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(purchase ?? null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(purchase);

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !draft.item_name.trim()) {
      setError("Adj meg egy megnevezést.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const quantity = Number(draft.quantity) || 0;
      const unitPrice = draft.unit_price.trim() ? Number(draft.unit_price) : null;
      const totalPrice = draft.total_price.trim()
        ? Number(draft.total_price)
        : unitPrice != null
          ? quantity * unitPrice
          : null;

      const payload = {
        supplier_id: supplierId,
        item_name: draft.item_name.trim(),
        type: draft.type,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        currency: draft.currency,
        supplier_order_number: draft.supplier_order_number.trim() || null,
        order_date: draft.order_date || null,
        status: draft.status,
        tracking_number: draft.tracking_number.trim() || null,
        shipped_date: draft.shipped_date || null,
        expected_arrival_start: draft.expected_arrival_start || null,
        expected_arrival_end: draft.expected_arrival_end || null,
        actual_arrival_date: draft.actual_arrival_date || null,
        notes: draft.notes.trim() || null,
      };

      const { data, error: saveError } = isEdit
        ? await supabase.from("purchases").update(payload).eq("id", purchase!.id).select().single()
        : await supabase.from("purchases").insert(payload).select().single();
      if (saveError) throw saveError;
      if (data) onSaved(data);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a beszerzést."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Megnevezés *</label>
          <input
            className="input"
            required
            autoFocus
            value={draft.item_name}
            onChange={(e) => set("item_name", e.target.value)}
            placeholder="pl. Pear Edition – mintapakli"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
          <select className="select" value={draft.type} onChange={(e) => set("type", e.target.value as PurchaseType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
          <select
            className="select"
            value={draft.status}
            onChange={(e) => set("status", e.target.value as PurchaseStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Darabszám</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input"
            value={draft.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Egységár</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={draft.unit_price}
              onChange={(e) => set("unit_price", e.target.value)}
              placeholder="pl. 16.17"
            />
            <select
              className="select w-24 shrink-0"
              value={draft.currency}
              onChange={(e) => set("currency", e.target.value as CurrencyCode)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Végösszeg</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={draft.total_price}
            onChange={(e) => set("total_price", e.target.value)}
            placeholder="üresen hagyva: darabszám × egységár"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Beszállítói rendelésszám</label>
          <input
            className="input"
            value={draft.supplier_order_number}
            onChange={(e) => set("supplier_order_number", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Rendelés dátuma</label>
          <input
            type="date"
            className="input"
            value={draft.order_date}
            onChange={(e) => set("order_date", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Csomagszám (tracking)</label>
          <input
            className="input"
            value={draft.tracking_number}
            onChange={(e) => set("tracking_number", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Feladás dátuma</label>
          <input
            type="date"
            className="input"
            value={draft.shipped_date}
            onChange={(e) => set("shipped_date", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Várható érkezés (tól)</label>
          <input
            type="date"
            className="input"
            value={draft.expected_arrival_start}
            onChange={(e) => set("expected_arrival_start", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Várható érkezés (ig)</label>
          <input
            type="date"
            className="input"
            value={draft.expected_arrival_end}
            onChange={(e) => set("expected_arrival_end", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tényleges érkezés</label>
          <input
            type="date"
            className="input"
            value={draft.actual_arrival_date}
            onChange={(e) => set("actual_arrival_date", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Jegyzet</label>
        <textarea
          className="textarea min-h-20"
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Bármi, amit érdemes tudni — pl. ellenőrzőlista érkezéskor…"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : isEdit ? "Beszerzés mentése" : "Beszerzés hozzáadása"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}
