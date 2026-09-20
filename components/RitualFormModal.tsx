"use client";

import { useState } from "react";
import { X, Check, Rocket } from "lucide-react";
import type { Ritual, ContentStatus } from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import { CONTENT_STATUSES, CONTENT_STATUS_HU, RITUAL_CATEGORY_SUGGESTIONS } from "@/lib/labels";
import { bumpVersion } from "@/lib/content-version";
import RitualStepsEditor from "@/components/RitualStepsEditor";

export type RitualFormValues = {
  name: string;
  category: string;
  duration_minutes: string;
  steps: string[];
  status: ContentStatus;
  version: string;
};

function emptyForm(): RitualFormValues {
  return { name: "", category: "", duration_minutes: "", steps: [""], status: "draft", version: "v1.0" };
}

// Opening an existing ritual for edit pre-fills the version field with
// the *next* version, on the theory that an edit usually is a new
// version — the founder can still leave it unchanged for a trivial fix.
function formFromRitual(ritual: Ritual): RitualFormValues {
  return {
    name: ritual.name,
    category: ritual.category ?? "",
    duration_minutes: ritual.duration_minutes != null ? String(ritual.duration_minutes) : "",
    steps: ritual.steps.length > 0 ? ritual.steps : [""],
    status: ritual.status,
    version: bumpVersion(ritual.version),
  };
}

/**
 * Create/edit form for the Ritual Builder — Mentés keeps whatever
 * status is selected, Publikálás is a shortcut that saves with status
 * forced to "published" regardless of the dropdown, matching the
 * founder's own CREATE RITUAL / SAVE / PUBLISH sketch.
 */
export default function RitualFormModal({
  ritual,
  onSave,
  onClose,
}: {
  ritual: Ritual | null;
  onSave: (values: RitualFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RitualFormValues>(ritual ? formFromRitual(ritual) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: ContentStatus) {
    if (!form.name.trim() || !form.version.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        status,
        name: form.name.trim(),
        category: form.category.trim(),
        version: form.version.trim(),
        steps: form.steps.map((s) => s.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a rituálét.");
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
        className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-serif text-lg text-forest">{ritual ? "Rituálé szerkesztése" : "Új rituálé"}</h2>
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
          <BackButton onClick={onClose} label="Vissza a listához" />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
            <input
              className="input"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder='pl. "10 Minutes of Us"'
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
              <input
                className="input"
                list="ritual-categories"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="pl. RECONNECT"
              />
              <datalist id="ritual-categories">
                {RITUAL_CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
                placeholder="pl. 10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Lépések</label>
            <RitualStepsEditor steps={form.steps} onChange={(steps) => setForm((f) => ({ ...f, steps }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
