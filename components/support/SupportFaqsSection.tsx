"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, HelpCircle, FileDown } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { SupportFaq, SupportFaqLanguage } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import CollapsibleSection from "@/components/CollapsibleSection";
import ShowMoreButton from "@/components/ShowMoreButton";
import { useUndoAction } from "@/lib/useUndoAction";
import { useShowMore } from "@/lib/useShowMore";
import { SUPPORT_FAQ_LANGUAGES, SUPPORT_FAQ_LANGUAGE_HU, SUPPORT_FAQ_LANGUAGE_STYLES } from "@/lib/labels";
import { downloadFaqPdf } from "@/lib/faq-pdf";
import { errorMessage } from "@/lib/errors";

function byQuestionAsc(a: SupportFaq, b: SupportFaq) {
  return a.question.localeCompare(b.question);
}

/**
 * GYIK — kérdés+válasz könyvtár, nyelv szerint (HU/DE/EN) elkülönítve,
 * ugyanaz a csoportosítás-minta, mint a Marketing anyagok nyelvi
 * bontásánál. Mindegyik nyelvi csoport, és az egész lista is, letölthető
 * PDF-ben (lib/faq-pdf.ts).
 */
export default function SupportFaqsSection() {
  const supabase = getSupabaseClient();
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("support_faqs").select("*");
    if (loadError) setError(errorMessage(loadError, "Nem sikerült betölteni a GYIK-listát."));
    setFaqs(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  function handleDelete(faq: SupportFaq) {
    if (!supabase) return;
    if (editingId === faq.id) setEditingId(null);
    setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
    scheduleUndo(
      `"${faq.question}" törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("support_faqs").delete().eq("id", faq.id);
        if (deleteError) console.error(deleteError.message);
      },
      () => setFaqs((prev) => [...prev, faq])
    );
  }

  if (loading) return <Spinner />;

  const grouped = SUPPORT_FAQ_LANGUAGES.map((lang) => ({
    lang,
    items: faqs.filter((f) => f.language === lang),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Gyakran ismételt kérdések — bővítsd, ahogy új típusú kérdések érkeznek.</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {faqs.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost !px-3 !py-1.5 text-xs"
              onClick={() => downloadFaqPdf(faqs, "all")}
            >
              <FileDown size={14} /> Teljes GYIK (PDF)
            </button>
          )}
          <button
            type="button"
            className="btn btn-bronze !px-3 !py-1.5 text-xs"
            onClick={() => {
              setEditingId(null);
              setShowForm((v) => !v);
            }}
          >
            <Plus size={14} /> Új GYIK
          </button>
        </div>
      </div>

      {showForm && (
        <FaqForm
          onSaved={(f) => {
            setFaqs((prev) => [...prev, f]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {faqs.length === 0 ? (
        <EmptyState icon={HelpCircle} title="Még nincs GYIK-bejegyzés" description="Add hozzá a leggyakrabban felmerülő kérdéseket és a rájuk adott válaszokat." />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ lang, items }) => (
            <FaqLanguageGroup
              key={lang}
              lang={lang}
              items={items}
              editingId={editingId}
              onEdit={setEditingId}
              onSaved={(saved) => {
                setFaqs((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                setEditingId(null);
              }}
              onCancelEdit={() => setEditingId(null)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function FaqLanguageGroup({
  lang,
  items,
  editingId,
  onEdit,
  onSaved,
  onCancelEdit,
  onDelete,
}: {
  lang: SupportFaqLanguage;
  items: SupportFaq[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onSaved: (f: SupportFaq) => void;
  onCancelEdit: () => void;
  onDelete: (f: SupportFaq) => void;
}) {
  const sorted = [...items].sort(byQuestionAsc);
  const { visible, hiddenCount, showAll, setShowAll } = useShowMore(sorted, 8);

  return (
    <CollapsibleSection
      title={
        <h2 className="font-serif text-lg text-forest">
          <span className={`badge mr-2 ${SUPPORT_FAQ_LANGUAGE_STYLES[lang]}`}>{SUPPORT_FAQ_LANGUAGE_HU[lang]}</span>
        </h2>
      }
      right={<span className="badge bg-ivory-dim text-walnut">{items.length}</span>}
      actions={
        <button
          type="button"
          onClick={() => downloadFaqPdf(items, lang)}
          className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
        >
          <FileDown size={12} /> PDF
        </button>
      }
      storageKey={`zusammen-collapsed-support-faqs-lang-${lang}`}
      headerClassName="mb-2"
    >
      <div className="flex flex-col gap-1.5">
        {visible.map((f) =>
          editingId === f.id ? (
            <FaqEditRow key={f.id} faq={f} onSaved={onSaved} onCancel={onCancelEdit} />
          ) : (
            <div key={f.id} className="rounded-md border border-border px-3 py-2.5 text-sm hover:border-bronze/40">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-forest">{f.question}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => onEdit(f.id)} className="text-muted/70 hover:text-forest" title="Szerkesztés">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => onDelete(f)} className="text-muted/70 hover:text-red-600" title="Törlés">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{f.answer}</p>
            </div>
          )
        )}
      </div>
      {sorted.length > 8 && (
        <ShowMoreButton hiddenCount={hiddenCount} showAll={showAll} onToggle={() => setShowAll((v) => !v)} />
      )}
    </CollapsibleSection>
  );
}

function FaqForm({ onSaved, onCancel }: { onSaved: (f: SupportFaq) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [language, setLanguage] = useState<SupportFaqLanguage>("hu");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !question.trim() || !answer.trim()) {
      setError("Adj meg egy kérdést és egy választ.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("support_faqs")
      .insert({ question: question.trim(), answer: answer.trim(), language })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a GYIK-et."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={submit} className="flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Nyelv *</label>
        <div className="flex gap-2">
          {SUPPORT_FAQ_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={`badge cursor-pointer border ${
                language === l ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
              }`}
            >
              {SUPPORT_FAQ_LANGUAGE_HU[l]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Kérdés *</label>
        <input className="input" required autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="pl. Mennyi a szállítási idő?" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Válasz *</label>
        <textarea className="textarea min-h-20" required value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "GYIK mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function FaqEditRow({ faq, onSaved, onCancel }: { faq: SupportFaq; onSaved: (f: SupportFaq) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [language, setLanguage] = useState<SupportFaqLanguage>(faq.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !question.trim() || !answer.trim()) {
      setError("Adj meg egy kérdést és egy választ.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("support_faqs")
      .update({ question: question.trim(), answer: answer.trim(), language })
      .eq("id", faq.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a GYIK-et."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Nyelv *</label>
        <div className="flex gap-2">
          {SUPPORT_FAQ_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={`badge cursor-pointer border ${
                language === l ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
              }`}
            >
              {SUPPORT_FAQ_LANGUAGE_HU[l]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Kérdés *</label>
        <input className="input" required autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Válasz *</label>
        <textarea className="textarea min-h-20" required value={answer} onChange={(e) => setAnswer(e.target.value)} />
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
