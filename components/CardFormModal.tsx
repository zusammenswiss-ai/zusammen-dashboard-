"use client";

import { useEffect, useState } from "react";
import { X, Check, Rocket, QrCode } from "lucide-react";
import type { ContentCard, ContentStatus } from "@/lib/supabase/types";
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_HU,
  CARD_CATEGORY_SUGGESTIONS,
  CARD_ENERGY_SUGGESTIONS,
  CARD_DEPTH_SUGGESTIONS,
  CARD_MODE_SUGGESTIONS,
  CARD_JOURNEY_SUGGESTIONS,
} from "@/lib/labels";
import { bumpVersion } from "@/lib/content-version";

export type CardFormValues = {
  title: string;
  category: string;
  question: string;
  short_description: string;
  deep_question: string;
  ritual_id: string;
  duration_minutes: string;
  energy: string;
  depth: string;
  mode: string;
  nfc_id: string;
  qr_url: string;
  journey: string;
  status: ContentStatus;
  version: string;
};

function emptyForm(): CardFormValues {
  return {
    title: "",
    category: "",
    question: "",
    short_description: "",
    deep_question: "",
    ritual_id: "",
    duration_minutes: "",
    energy: "",
    depth: "",
    mode: "",
    nfc_id: "",
    qr_url: "",
    journey: "",
    status: "draft",
    version: "v1.0",
  };
}

// Same "pre-fill with the next version" reasoning as RitualFormModal.
function formFromCard(card: ContentCard): CardFormValues {
  return {
    title: card.title,
    category: card.category ?? "",
    question: card.question ?? "",
    short_description: card.short_description ?? "",
    deep_question: card.deep_question ?? "",
    ritual_id: card.ritual_id ?? "",
    duration_minutes: card.duration_minutes != null ? String(card.duration_minutes) : "",
    energy: card.energy ?? "",
    depth: card.depth ?? "",
    mode: card.mode ?? "",
    nfc_id: card.nfc_id ?? "",
    qr_url: card.qr_url ?? "",
    journey: card.journey ?? "",
    status: card.status,
    version: bumpVersion(card.version),
  };
}

/** Small live QR preview for the QR URL field — generated fully
 * client-side with the same `qrcode` package /api/qr already uses
 * server-side, so no extra API route is needed for arbitrary URLs. */
function QrPreview({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDataUrl(null);
      return;
    }
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(url.trim(), { width: 96, margin: 1, color: { dark: "#233328", light: "#00000000" } })
      )
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR kód előnézet" className="mt-2 h-20 w-20 rounded-md bg-ivory-dim p-1" />;
}

/**
 * Create/edit form for a Kártya — same Mentés/Publikálás pair as
 * RitualFormModal for a consistent workflow across both content types.
 */
export default function CardFormModal({
  card,
  rituals,
  onSave,
  onClose,
}: {
  card: ContentCard | null;
  rituals: { id: string; name: string }[];
  onSave: (values: CardFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CardFormValues>(card ? formFromCard(card) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: ContentStatus) {
    if (!form.title.trim() || !form.version.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, status, title: form.title.trim(), version: form.version.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a kártyát.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(form.status);
        }}
        className="animate-fade-in card flex max-h-full w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-serif text-lg text-forest">
            {card ? `Kártya szerkesztése — #${String(card.card_number).padStart(2, "0")}` : "Új kártya"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
              <input
                className="input"
                list="card-categories"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="pl. RECONNECT"
              />
              <datalist id="card-categories">
                {CARD_CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kérdés</label>
            <textarea
              className="textarea min-h-16"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder='pl. "What makes you feel safe with me?"'
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Rövid leírás</label>
            <textarea
              className="textarea min-h-14"
              value={form.short_description}
              onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Mély kérdés</label>
            <textarea
              className="textarea min-h-16"
              value={form.deep_question}
              onChange={(e) => setForm((f) => ({ ...f, deep_question: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Rituálé</label>
              <select
                className="select"
                value={form.ritual_id}
                onChange={(e) => setForm((f) => ({ ...f, ritual_id: e.target.value }))}
              >
                <option value="">— Nincs —</option>
                {rituals.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Időtartam (perc)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Energia</label>
              <input
                className="input"
                list="card-energy"
                value={form.energy}
                onChange={(e) => setForm((f) => ({ ...f, energy: e.target.value }))}
              />
              <datalist id="card-energy">
                {CARD_ENERGY_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Mélység</label>
              <input
                className="input"
                list="card-depth"
                value={form.depth}
                onChange={(e) => setForm((f) => ({ ...f, depth: e.target.value }))}
              />
              <datalist id="card-depth">
                {CARD_DEPTH_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Mód</label>
              <input
                className="input"
                list="card-mode"
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              />
              <datalist id="card-mode">
                {CARD_MODE_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Journey</label>
            <input
              className="input"
              list="card-journey"
              value={form.journey}
              onChange={(e) => setForm((f) => ({ ...f, journey: e.target.value }))}
            />
            <datalist id="card-journey">
              {CARD_JOURNEY_SUGGESTIONS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">NFC ID</label>
              <input
                className="input"
                value={form.nfc_id}
                onChange={(e) => setForm((f) => ({ ...f, nfc_id: e.target.value }))}
                placeholder="a fizikai kártyába írt NFC azonosító"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                <QrCode size={12} /> QR URL
              </label>
              <input
                className="input"
                value={form.qr_url}
                onChange={(e) => setForm((f) => ({ ...f, qr_url: e.target.value }))}
                placeholder="https://…"
              />
              <QrPreview url={form.qr_url} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContentStatus }))}
              >
                {CONTENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTENT_STATUS_HU[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Verzió *</label>
              <input
                className="input"
                required
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
          </button>
          <button type="button" disabled={saving} onClick={() => void submit("published")} className="btn btn-bronze">
            <Rocket size={14} /> Publikálás
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
