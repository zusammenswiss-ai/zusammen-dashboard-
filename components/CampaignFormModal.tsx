"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, Season } from "@/lib/supabase/types";
import { SEASON_HU } from "@/lib/labels";

const SEASON_ORDER: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

/** Minimal create-only form for a new Kampány (the named-marketing-push
 * entity, not the 4 fixed Évszakos stratégia rows — see the comment on
 * the Campaign type). Used from two places: the Marketing oldal's
 * per-season "+ Új kampány hozzáadása" button (pre-fills season), and the
 * Feladatok oldal's inline "+ Új kampány" quick-add when picking which
 * kampány a Kampány-típusú task belongs to (no prefill there). Stacked at
 * z-[60] so it still reads on top when opened from inside TaskDetailModal
 * (z-50). */
export default function CampaignFormModal({
  defaultSeason = null,
  onClose,
  onCreated,
}: {
  defaultSeason?: Season | null;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const [name, setName] = useState("");
  const [season, setSeason] = useState<Season | "">(defaultSeason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !name.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("campaigns")
      .insert({ name: name.trim(), season: season || null })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex w-full max-w-sm flex-col gap-3 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-forest">Új kampány</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kampány neve *</label>
            <input
              className="input"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='pl. "ZUSAMMEN FIRST 20"'
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Évszak</label>
            <select className="select" value={season} onChange={(e) => setSeason(e.target.value as Season | "")}>
              <option value="">Nincs</option>
              {SEASON_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SEASON_HU[s]}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Kampány létrehozása"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Mégse
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
