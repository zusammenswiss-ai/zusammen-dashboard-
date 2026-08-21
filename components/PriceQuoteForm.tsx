"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { PriceQuote } from "@/lib/supabase/types";

const STORAGE_BUCKET = "price-quotes";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "+ Új árajánlat hozzáadása" form, shared by the Kártya-fájlok detail
 * modal (card asset locked, supplier picked from a select) and the
 * Beszállítók profile (supplier locked, card version picked instead) —
 * whichever side is already known is passed as a locked id and hidden;
 * the other stays a dropdown.
 */
export default function PriceQuoteForm({
  cardAssetId,
  supplierId,
  cardAssetOptions,
  supplierOptions,
  onCreated,
  onCancel,
}: {
  cardAssetId?: string;
  supplierId?: string;
  cardAssetOptions?: { id: string; label: string }[];
  supplierOptions?: { id: string; name: string }[];
  onCreated: (quote: PriceQuote) => void;
  onCancel: () => void;
}) {
  const [selectedCardAssetId, setSelectedCardAssetId] = useState(cardAssetOptions?.[0]?.id ?? "");
  const [selectedSupplierId, setSelectedSupplierId] = useState(supplierOptions?.[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [quoteDate, setQuoteDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const finalCardAssetId = cardAssetId ?? selectedCardAssetId;
    const finalSupplierId = supplierId ?? selectedSupplierId;
    if (!supabase || !finalCardAssetId || !finalSupplierId || !quantity) {
      setError("Válassz kártya-verziót, beszállítót, és add meg a mennyiséget.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let screenshotUrl: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        screenshotUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      }

      const qty = Number(quantity);
      const price = unitPrice.trim() ? Number(unitPrice) : null;
      // total_price isn't its own form field — it's derived whenever a
      // unit price was actually given, per spec.
      const totalPrice = price != null ? qty * price : null;

      const { data, error: insertError } = await supabase
        .from("price_quotes")
        .insert({
          card_asset_id: finalCardAssetId,
          supplier_id: finalSupplierId,
          quantity: qty,
          unit_price: price,
          currency: price != null ? currency.trim() || null : null,
          total_price: totalPrice,
          screenshot_url: screenshotUrl,
          notes: notes.trim() || null,
          quote_date: quoteDate,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni az árajánlatot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!cardAssetId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kártya-verzió *</label>
            <select
              className="select"
              required
              value={selectedCardAssetId}
              onChange={(e) => setSelectedCardAssetId(e.target.value)}
            >
              <option value="" disabled>
                Válassz…
              </option>
              {(cardAssetOptions ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!supplierId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Beszállító *</label>
            <select
              className="select"
              required
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
            >
              <option value="" disabled>
                Válassz…
              </option>
              {(supplierOptions ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Mennyiség *</label>
          <input
            type="number"
            min="0"
            step="1"
            required
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="pl. 500"
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
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="pl. 1.20"
            />
            <input
              className="input w-20"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="CHF"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
          <input
            type="date"
            className="input"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kép feltöltése</label>
          <input
            type="file"
            accept="image/*"
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea
          className="textarea min-h-16"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bármi, amit érdemes tudni erről az ajánlatról…"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Árajánlat mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}
