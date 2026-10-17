"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Tag, Loader2 } from "lucide-react";
import type { MailLabel } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { errorMessage } from "@/lib/errors";

const DEFAULT_COLORS = ["#9a6a39", "#294238", "#b45309", "#1d4ed8", "#be123c", "#15803d", "#7c3aed"];

/** Postafiók → Címkék — szabadon létrehozható, színes címkék (feladat
 * 5/B/c pont). A szálhoz rendelés magából a szálnézetből történik, lásd
 * MailThreadView.tsx LabelPicker-jét. */
export default function MailLabelsSection() {
  const [labels, setLabels] = useState<MailLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/labels");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült betölteni a címkéket.");
      setLabels(data.labels);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült betölteni a címkéket."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/mail/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), color }) });
      setName("");
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(label: MailLabel) {
    if (!window.confirm(`Biztosan törlöd a(z) "${label.name}" címkét?`)) return;
    await fetch(`/api/mail/labels/${label.id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-bronze/30 bg-ivory-dim/40 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">Új címke neve</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Sürgős" />
        </div>
        <div className="flex gap-1">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-forest" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        <button type="button" onClick={() => void create()} disabled={saving || !name.trim()} className="btn btn-bronze !py-1.5 text-xs">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Hozzáadás
        </button>
      </div>

      {labels.length === 0 ? (
        <EmptyState icon={Tag} title="Még nincs címke" description="Vedd fel az elsőt fent." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <span key={l.id} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: l.color }}>
              {l.name}
              <button type="button" onClick={() => void remove(l)} className="hover:opacity-70">
                <Trash2 size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
