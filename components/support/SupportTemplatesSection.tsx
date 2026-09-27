"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Copy, FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { SupportTemplate } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { errorMessage } from "@/lib/errors";

function byTitleAsc(a: SupportTemplate, b: SupportTemplate) {
  return a.title.localeCompare(b.title);
}

/**
 * Sablonválaszok — v1, egyszerű cím+szöveg könyvtár gyakori ügyfél-
 * válaszokhoz (pl. "szállítási idő", "csere/visszaküldés"). Nincs külső
 * eszköz-összekapcsolás; a "Másolás" gomb a vágólapra teszi a szöveget,
 * hogy bárhonnan (email, Instagram DM) bemásolható legyen.
 */
export default function SupportTemplatesSection() {
  const supabase = getSupabaseClient();
  const [templates, setTemplates] = useState<SupportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("support_templates").select("*");
    if (loadError) setError(errorMessage(loadError, "Nem sikerült betölteni a sablonválaszokat."));
    setTemplates(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function copy(template: SupportTemplate) {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopiedId(template.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API can be unavailable — the text is still visible to select and copy manually.
    }
  }

  function handleDelete(template: SupportTemplate) {
    if (!supabase) return;
    if (editingId === template.id) setEditingId(null);
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    scheduleUndo(
      `"${template.title}" sablon törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("support_templates").delete().eq("id", template.id);
        if (deleteError) console.error(deleteError.message);
      },
      () => setTemplates((prev) => [...prev, template])
    );
  }

  if (loading) return <Spinner />;

  const sorted = [...templates].sort(byTitleAsc);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Gyakori válaszok, amiket egy kattintással a vágólapra másolhatsz.</p>
        <button
          type="button"
          className="btn btn-bronze !px-3 !py-1.5 text-xs shrink-0"
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus size={14} /> Új sablon
        </button>
      </div>

      {showForm && (
        <TemplateForm
          onSaved={(t) => {
            setTemplates((prev) => [...prev, t]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={FileText} title="Még nincs sablonválasz" description="Add hozzá a leggyakrabban visszatérő válaszaidat, hogy ne kelljen mindig újraírni." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((t) =>
            editingId === t.id ? (
              <TemplateEditRow
                key={t.id}
                template={t}
                onSaved={(saved) => {
                  setTemplates((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={t.id} className="rounded-md border border-border px-3 py-2.5 text-sm hover:border-bronze/40">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-forest">{t.title}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => void copy(t)}
                      className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
                    >
                      {copiedId === t.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === t.id ? "Másolva" : "Másolás"}
                    </button>
                    <button onClick={() => setEditingId(t.id)} className="text-muted/70 hover:text-forest" title="Szerkesztés">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(t)} className="text-muted/70 hover:text-red-600" title="Törlés">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{t.body}</p>
              </div>
            )
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function TemplateForm({ onSaved, onCancel }: { onSaved: (t: SupportTemplate) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim() || !body.trim()) {
      setError("Adj meg egy címet és a válasz szövegét.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("support_templates")
      .insert({ title: title.trim(), body: body.trim() })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a sablont."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={submit} className="flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
        <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="pl. Szállítási idő" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Válasz szövege *</label>
        <textarea className="textarea min-h-24" required value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Sablon mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function TemplateEditRow({
  template,
  onSaved,
  onCancel,
}: {
  template: SupportTemplate;
  onSaved: (t: SupportTemplate) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim() || !body.trim()) {
      setError("Adj meg egy címet és a válasz szövegét.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("support_templates")
      .update({ title: title.trim(), body: body.trim() })
      .eq("id", template.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a sablont."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
        <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Válasz szövege *</label>
        <textarea className="textarea min-h-24" required value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Mégse
        </button>
      </div>
    </form>
  );
}
