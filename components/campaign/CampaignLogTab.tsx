"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, NotebookPen } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, CampaignLogEntry, CampaignLogType } from "@/lib/supabase/types";
import { CAMPAIGN_LOG_TYPES, CAMPAIGN_LOG_TYPE_STYLES } from "@/lib/labels";
import EmptyState from "@/components/EmptyState";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import { formatDate } from "@/lib/format";

const EMPTY_FORM = { text: "", type: "Megjegyzés" as CampaignLogType, author: "" };

/** Napló fül — időrendi bejegyzések (Döntés / Tanulság / Esemény /
 * Megjegyzés), hogy a kampány lezárása után is visszakövethető legyen,
 * mi és miért történt útközben. */
export default function CampaignLogTab({ campaign }: { campaign: Campaign }) {
  const [entries, setEntries] = useState<CampaignLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("campaign_log")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("entry_date", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setEntries(data ?? []);
    setLoading(false);
  }, [campaign.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.text.trim()) return;
    setSaving(true);
    const { error: insertError } = await supabase.from("campaign_log").insert({
      campaign_id: campaign.id,
      text: form.text.trim(),
      type: form.type,
      author: form.author.trim() || null,
    });
    setSaving(false);
    if (insertError) setError(insertError.message);
    else {
      setForm(EMPTY_FORM);
      setShowForm(false);
      void load();
    }
  }

  async function deleteEntry(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error: deleteError } = await supabase.from("campaign_log").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      {error && <ErrorBanner message={error} />}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">Döntések, tanulságok, események — időrendben.</p>
        <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Bejegyzés
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
              <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampaignLogType }))}>
                {CAMPAIGN_LOG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Szerző</label>
              <input className="input" value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} placeholder="opcionális" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Szöveg *</label>
              <textarea className="textarea min-h-20" required autoFocus value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Mentés"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Még nincs naplóbejegyzés" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${CAMPAIGN_LOG_TYPE_STYLES[entry.type]}`}>{entry.type}</span>
                  {entry.author && <span className="text-xs text-muted">{entry.author}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{formatDate(entry.entry_date)}</span>
                  <button onClick={() => deleteEntry(entry.id)} className="text-muted/70 hover:text-red-600" title="Törlés">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-forest">{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
