"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, FileText, Loader2 } from "lucide-react";
import type { MailTemplate, MailTemplateType, MailArea } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { errorMessage } from "@/lib/errors";

const TYPE_LABEL: Record<MailTemplateType, string> = { standard: "Általános", support_reply: "Ügyfélszolgálati válasz" };

/** Postafiók → Sablonok — gyorsválasz-sablonok CRUD-ja (feladat 5/B/i
 * pont). A tényleges felhasználás (változó-helyettesítéssel a
 * válasz-szerkesztőbe fűzve) MailThreadView.tsx ReplyAndNoteComposer-jében
 * van, lásd ott a "Sablon beszúrása" választót. */
export default function MailTemplatesSection() {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [areas, setAreas] = useState<MailArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<"new" | string | null>(null);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/templates");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült betölteni a sablonokat.");
      setTemplates(data.templates);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült betölteni a sablonokat."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("mail_areas").select("*").order("sort_order");
      setAreas(data ?? []);
    })();
  }, [supabase]);

  async function handleDelete(template: MailTemplate) {
    if (!window.confirm(`Biztosan törlöd a(z) "${template.name}" sablont?`)) return;
    await fetch(`/api/mail/templates/${template.id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Területenkénti gyorsválaszok — {"{{first_name}}"}, {"{{order_number}}"}, {"{{subject}}"} változókkal.</p>
        <button type="button" className="btn btn-bronze shrink-0 !px-3 !py-1.5 text-xs" onClick={() => setShowForm(showForm === "new" ? null : "new")}>
          <Plus size={14} /> Új sablon
        </button>
      </div>

      {showForm === "new" && (
        <TemplateForm
          areas={areas}
          onCancel={() => setShowForm(null)}
          onSaved={() => {
            setShowForm(null);
            void load();
          }}
        />
      )}

      {templates.length === 0 ? (
        <EmptyState icon={FileText} title="Még nincs sablon" description="Vedd fel az elsőt az 'Új sablon' gombbal." />
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) =>
            showForm === t.id ? (
              <TemplateForm
                key={t.id}
                template={t}
                areas={areas}
                onCancel={() => setShowForm(null)}
                onSaved={() => {
                  setShowForm(null);
                  void load();
                }}
              />
            ) : (
              <div key={t.id} className="rounded-xl border border-border bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-forest">{t.name}</span>
                    {t.area && <span className="badge bg-ivory-dim text-walnut">{areas.find((a) => a.key === t.area)?.label || t.area}</span>}
                    <span className="badge bg-forest-light/15 text-forest">{TYPE_LABEL[t.type]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setShowForm(t.id)} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => void handleDelete(t)} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {t.subject && <p className="mt-1 text-xs text-muted">Tárgy: {t.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap text-xs text-walnut">{t.body.slice(0, 200)}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function TemplateForm({
  template,
  areas,
  onCancel,
  onSaved,
}: {
  template?: MailTemplate;
  areas: MailArea[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [area, setArea] = useState(template?.area ?? "");
  const [type, setType] = useState<MailTemplateType>(template?.type ?? "standard");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !body.trim()) {
      setError("Név és szöveg megadása kötelező.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const endpoint = template ? `/api/mail/templates/${template.id}` : "/api/mail/templates";
      const method = template ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), area: area || null, type, subject: subject.trim() || null, body }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült menteni.");
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-bronze/30 bg-ivory-dim/40 p-4">
      {error && <ErrorBanner message={error} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Terület</label>
          <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">— bármelyik —</option>
            {areas.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as MailTemplateType)}>
            <option value="standard">Általános</option>
            <option value="support_reply">Ügyfélszolgálati válasz</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Tárgy (opcionális)</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Szöveg * — {"{{first_name}}"}, {"{{order_number}}"}, {"{{subject}}"}</label>
        <textarea className="textarea min-h-28" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Mégse
        </button>
        <button type="button" className="btn btn-bronze" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Mentés
        </button>
      </div>
    </div>
  );
}
