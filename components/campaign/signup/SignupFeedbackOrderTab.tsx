"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, First20Language, First20InvoiceStatus } from "@/lib/supabase/types";
import { ErrorBanner } from "@/components/Feedback";
import { formatDate } from "@/lib/format";

const WOULD_BUY_LABEL = { igen: "Igen, azonnal", talan: "Talán, attól függ", nem: "Valószínűleg nem" } as const;
const LANG_OPTIONS: First20Language[] = ["hu", "de", "en"];
const LANG_LABEL = { hu: "Magyar", de: "Német", en: "Angol" } as const;
const INVOICE_STATUSES: First20InvoiceStatus[] = ["nincs", "elküldve", "kifizetve"];

type OrderDraft = {
  order_language: First20Language | "";
  ship_name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  founders_price: boolean;
  invoice_status: First20InvoiceStatus;
};

function draftFrom(signup: First20Signup): OrderDraft {
  return {
    order_language: signup.order_language ?? "",
    ship_name: signup.ship_name ?? "",
    street: signup.street ?? "",
    zip: signup.zip ?? "",
    city: signup.city ?? "",
    country: signup.country ?? "",
    founders_price: signup.founders_price ?? true,
    invoice_status: signup.invoice_status,
  };
}

export default function SignupFeedbackOrderTab({
  signup,
  onUpdated,
}: {
  signup: First20Signup;
  onUpdated: () => void;
}) {
  const [draft, setDraft] = useState<OrderDraft>(draftFrom(signup));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("first20_signups")
      .update({
        order_language: draft.order_language || null,
        ship_name: draft.ship_name.trim() || null,
        street: draft.street.trim() || null,
        zip: draft.zip.trim() || null,
        city: draft.city.trim() || null,
        country: draft.country.trim() || null,
        founders_price: draft.founders_price,
        invoice_status: draft.invoice_status,
      })
      .eq("id", signup.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onUpdated();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorBanner message={error} />}

      <section>
        <h3 className="mb-3 font-serif text-base text-forest">Visszajelzés</h3>
        {signup.feedback_received_at ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted">Megvolt az est?</p>
              <p className="text-sm text-forest">{signup.evening_done ? "Igen" : "Nem / nem válaszolt"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Megvenné-e alapítói áron</p>
              <p className="text-sm text-forest">{signup.would_buy ? WOULD_BUY_LABEL[signup.would_buy] : "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted">Kedvenc kártya / mit változtatna</p>
              <p className="whitespace-pre-wrap text-sm text-forest">{signup.best_card_or_change || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted">Miért (indoklás)</p>
              <p className="whitespace-pre-wrap text-sm text-forest">{signup.would_buy_why || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Visszajelzés ideje</p>
              <p className="text-sm text-forest">{formatDate(signup.feedback_received_at)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Még nem érkezett visszajelzés.</p>
        )}
      </section>

      <section className="border-t border-border pt-5">
        <h3 className="mb-3 font-serif text-base text-forest">Rendelés</h3>
        <p className="mb-3 text-xs text-muted">
          Ezeket az adatokat kézzel rögzíted (telefonon/emailben kapott rendelés alapján) — nincs külön online rendelő űrlap.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Pakli nyelve</label>
            <select
              className="select"
              value={draft.order_language}
              onChange={(e) => setDraft((d) => ({ ...d, order_language: e.target.value as First20Language | "" }))}
            >
              <option value="">— nincs megadva —</option>
              {LANG_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {LANG_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Számla állapota</label>
            <select
              className="select"
              value={draft.invoice_status}
              onChange={(e) => setDraft((d) => ({ ...d, invoice_status: e.target.value as First20InvoiceStatus }))}
            >
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Címzett neve</label>
            <input className="input" value={draft.ship_name} onChange={(e) => setDraft((d) => ({ ...d, ship_name: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Utca, házszám</label>
            <input className="input" value={draft.street} onChange={(e) => setDraft((d) => ({ ...d, street: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Irányítószám</label>
            <input className="input" value={draft.zip} onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Város</label>
            <input className="input" value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Ország</label>
            <input className="input" value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-forest">
              <input
                type="checkbox"
                checked={draft.founders_price}
                onChange={(e) => setDraft((d) => ({ ...d, founders_price: e.target.checked }))}
              />
              Alapítói áron rendelt (CHF 24)
            </label>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Mentés…" : "Mentés"}
          </button>
          {saved && <span className="text-xs font-medium text-forest">Mentve</span>}
        </div>
      </section>
    </div>
  );
}
