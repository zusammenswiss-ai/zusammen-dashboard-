"use client";

import { useCallback, useEffect, useState } from "react";
import { Scale, ChevronDown, ChevronRight, Check } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { LegalDocument, UnlockHistoryEntry } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import CollapsibleSection from "@/components/CollapsibleSection";
import LockControls from "@/components/finance/LockControls";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

/**
 * Beállítások → Jogi dokumentumok — database-backed, lockable Impresszum
 * és Adatvédelem tartalom (see app/impresszum, app/adatvedelem for the
 * public pages that read what's saved here). Reuses
 * components/finance/LockControls.tsx as-is — it was already generic,
 * not Finance-specific — for the exact same "Rögzítés lezárása" seal /
 * "Zárolás feloldása" understated-link / indoklás-kérés UX as Fix/
 * Változó költségek and Bevételek.
 */
export default function LegalDocumentsSection() {
  const supabase = getSupabaseClient();
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("legal_documents").select("*").order("type");
    if (loadError) setError(errorMessage(loadError, "Nem sikerült betölteni a jogi dokumentumokat."));
    setDocs(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function handleLock(doc: LegalDocument) {
    if (!supabase) return;
    const { data, error: updateError } = await supabase
      .from("legal_documents")
      .update({ is_locked: true, locked_at: new Date().toISOString() })
      .eq("id", doc.id)
      .select()
      .single();
    if (updateError) throw updateError;
    if (data) setDocs((prev) => prev.map((d) => (d.id === data.id ? data : d)));
  }

  async function handleUnlock(doc: LegalDocument, reason: string | null) {
    if (!supabase) return;
    const entry: UnlockHistoryEntry = { unlocked_at: new Date().toISOString(), reason };
    const { data, error: updateError } = await supabase
      .from("legal_documents")
      .update({ is_locked: false, unlock_history: [...doc.unlock_history, entry] })
      .eq("id", doc.id)
      .select()
      .single();
    if (updateError) throw updateError;
    if (data) setDocs((prev) => prev.map((d) => (d.id === data.id ? data : d)));
  }

  async function handleSave(doc: LegalDocument, title: string, content: string) {
    if (!supabase) return;
    const { data, error: updateError } = await supabase
      .from("legal_documents")
      .update({ title, content, last_updated: new Date().toISOString().slice(0, 10) })
      .eq("id", doc.id)
      .select()
      .single();
    if (updateError) throw updateError;
    if (data) setDocs((prev) => prev.map((d) => (d.id === data.id ? data : d)));
  }

  if (loading) return <Spinner />;

  return (
    <div className="card p-5 sm:p-6">
      <CollapsibleSection
        title={
          <h2 className="flex items-center gap-2 font-serif text-lg text-forest">
            <Scale size={18} className="text-bronze" /> Jogi dokumentumok
          </h2>
        }
        storageKey="zusammen-collapsed-settings-legal-documents"
        defaultOpen={false}
        headerClassName="mb-4"
      >
        <p className="mb-4 text-xs text-muted">
          Impresszum és Adatvédelmi tájékoztató — élőben a /impresszum és /adatvedelem publikus oldalakon
          jelennek meg, bejelentkezés nélkül is. Zárolás után a cím és a tartalom nem szerkeszthető, amíg fel
          nem oldod.
        </p>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {docs.map((doc) => (
            <LegalDocumentRow
              key={doc.id}
              doc={doc}
              isOpen={openId === doc.id}
              onToggle={() => setOpenId((v) => (v === doc.id ? null : doc.id))}
              onLock={() => handleLock(doc)}
              onUnlock={(reason) => handleUnlock(doc, reason)}
              onSave={(title, content) => handleSave(doc, title, content)}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function LegalDocumentRow({
  doc,
  isOpen,
  onToggle,
  onLock,
  onUnlock,
  onSave,
}: {
  doc: LegalDocument;
  isOpen: boolean;
  onToggle: () => void;
  onLock: () => Promise<void>;
  onUnlock: (reason: string | null) => Promise<void>;
  onSave: (title: string, content: string) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <span className="font-medium text-forest">{doc.type}</span>
          <span className="ml-1.5 text-xs text-muted">{doc.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted">Módosítva: {formatDate(doc.last_updated)}</span>
          <span className={`badge ${doc.is_locked ? "bg-bronze/15 text-walnut" : "bg-ivory-dim text-walnut"}`}>
            {doc.is_locked ? "Zárolva" : "Szerkeszthető"}
          </span>
          {isOpen ? (
            <ChevronDown size={14} className="text-muted" />
          ) : (
            <ChevronRight size={14} className="text-muted" />
          )}
        </div>
      </button>
      {isOpen && <LegalDocumentEditor doc={doc} onLock={onLock} onUnlock={onUnlock} onSave={onSave} />}
    </div>
  );
}

function LegalDocumentEditor({
  doc,
  onLock,
  onUnlock,
  onSave,
}: {
  doc: LegalDocument;
  onLock: () => Promise<void>;
  onUnlock: (reason: string | null) => Promise<void>;
  onSave: (title: string, content: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = title !== doc.title || content !== doc.content;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(title.trim(), content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a dokumentumot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Publikus URL: <code className="rounded bg-ivory-dim px-1 py-0.5">/{doc.slug}</code>
        </p>
        <LockControls
          isLocked={doc.is_locked}
          lockedAt={doc.locked_at}
          unlockHistory={doc.unlock_history}
          onLock={onLock}
          onUnlock={onUnlock}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Cím</label>
        <input className="input" value={title} disabled={doc.is_locked} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Tartalom</label>
        <textarea
          className={`textarea min-h-[320px] font-mono text-sm ${doc.is_locked ? "opacity-60" : ""}`}
          value={content}
          disabled={doc.is_locked}
          onChange={(e) => setContent(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-muted">
          Alcímhez kezdd a sort &quot;## &quot;-lal, felsoroláshoz &quot;- &quot;-lal, bekezdések közé pedig hagyj
          egy üres sort.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!doc.is_locked && (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="btn btn-primary w-fit"
        >
          <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
        </button>
      )}
    </div>
  );
}
