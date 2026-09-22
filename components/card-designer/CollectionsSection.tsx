"use client";

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardCollection, CardCollectionInsert, CardExportVersion, CardTemplate, CollectionCard } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import CollectionDetailModal from "@/components/card-designer/CollectionDetailModal";
import { useUndoAction } from "@/lib/useUndoAction";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { CARD_COLLECTION_STATUS_STYLES, LANGUAGE_OPTIONS } from "@/lib/labels";

function byRecency(a: CardCollection, b: CardCollection) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default function CollectionsSection({
  collections,
  templates,
  cards,
  exportVersions,
  suppliers,
  onCollectionsChange,
  onCardsChange,
  onExportVersionsChange,
  deepLink,
}: {
  collections: CardCollection[];
  templates: CardTemplate[];
  cards: CollectionCard[];
  exportVersions: CardExportVersion[];
  suppliers: { id: string; name: string }[];
  onCollectionsChange: (next: CardCollection[]) => void;
  onCardsChange: (next: CollectionCard[]) => void;
  onExportVersionsChange: (next: CardExportVersion[]) => void;
  /** A Kártyák galéria (/cards) egy kattintással ide navigál, pontosan
   * azzal a kollekcióval/kártyával betöltve, amit szerkeszteni
   * szeretnél — lásd app/(dashboard)/card-designer/page.tsx. */
  deepLink?: { collectionId: string; cardId: string | null; back: boolean } | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  useEffect(() => {
    if (deepLink && collections.some((c) => c.id === deepLink.collectionId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenId(deepLink.collectionId);
    }
    // Csak akkor fusson újra, ha maga a deep link változik — a
    // collections-lista minden betöltéskor új referencia, de az nem ok
    // az újra-nyitásra (pl. ha a founder közben bezárta a modalt).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const sorted = [...collections].sort(byRecency);
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name]));
  const openCollection = collections.find((c) => c.id === openId) ?? null;

  function handleDelete(collection: CardCollection) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (openId === collection.id) setOpenId(null);
    onCollectionsChange(collections.filter((c) => c.id !== collection.id));
    scheduleUndo(
      `"${collection.name}" kollekció törölve.`,
      async () => {
        // A collection_cards sorok CASCADE-del törlődnek a DB-ben — ha
        // visszavonjuk, azok külön nem állnak vissza, csak a kollekció
        // maga (ugyanaz a korlát, mint bármelyik más kaszkádolt törlésnél
        // ebben az appban, pl. Beszállító törlésekor az árajánlatai).
        const { error } = await supabase.from("card_collections").delete().eq("id", collection.id);
        if (error) console.error(error.message);
      },
      () => onCollectionsChange([collection, ...collections.filter((c) => c.id !== collection.id)])
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Új kollekció
        </button>
      </div>

      {showForm && (
        <CollectionForm
          templates={templates}
          onCreated={(c) => {
            onCollectionsChange([c, ...collections]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Még nincs kollekció"
          description='Hozd létre az első kollekciót (pl. "Pear Edition"), és add hozzá a kártyáit.'
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => {
            const cardCount = cards.filter((card) => card.collection_id === c.id).length;
            const template = c.template_id ? templateById.get(c.template_id) : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="card flex flex-col gap-2 p-4 text-left hover:border-bronze/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-lg text-forest">{c.name}</p>
                  <span className={`badge shrink-0 ${CARD_COLLECTION_STATUS_STYLES[c.status]}`}>{c.status}</span>
                </div>
                {c.description && <p className="line-clamp-2 text-sm text-muted">{c.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="badge bg-ivory-dim text-walnut">{cardCount} kártya</span>
                  {template && <span className="badge bg-ivory-dim text-walnut">{template.name}</span>}
                  {c.supplier_id && supplierById.get(c.supplier_id) && (
                    <span className="badge bg-bronze/10 text-walnut">{supplierById.get(c.supplier_id)}</span>
                  )}
                  {c.languages.map((lang) => (
                    <span key={lang} className="badge bg-forest-light/15 text-forest">
                      {lang}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted">Utolsó módosítás: {formatDate(c.updated_at)}</p>
              </button>
            );
          })}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}

      {openCollection && (
        <CollectionDetailModal
          collection={openCollection}
          templates={templates}
          cards={cards.filter((card) => card.collection_id === openCollection.id)}
          exportVersions={exportVersions.filter((v) => v.collection_id === openCollection.id)}
          suppliers={suppliers}
          initialDesignCardId={deepLink?.collectionId === openCollection.id ? deepLink.cardId : null}
          initialShowBackEditor={deepLink?.collectionId === openCollection.id ? deepLink.back : false}
          onClose={() => setOpenId(null)}
          onCollectionSaved={(saved) => onCollectionsChange(collections.map((c) => (c.id === saved.id ? saved : c)))}
          onCardsChange={(nextForCollection) =>
            onCardsChange([...cards.filter((c) => c.collection_id !== openCollection.id), ...nextForCollection])
          }
          onExportVersionsChange={(nextForCollection) =>
            onExportVersionsChange([
              ...exportVersions.filter((v) => v.collection_id !== openCollection.id),
              ...nextForCollection,
            ])
          }
          onDelete={() => handleDelete(openCollection)}
        />
      )}
    </div>
  );
}

const EMPTY_FORM = { name: "", description: "", template_id: "", languages: [] as string[], customLanguage: "" };

function CollectionForm({
  templates,
  onCreated,
  onCancel,
}: {
  templates: CardTemplate[];
  onCreated: (c: CardCollection) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLanguage(lang: string) {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(lang) ? f.languages.filter((l) => l !== lang) : [...f.languages, lang],
    }));
  }

  function addCustomLanguage() {
    const lang = form.customLanguage.trim().toUpperCase();
    if (!lang || form.languages.includes(lang)) return;
    setForm((f) => ({ ...f, languages: [...f.languages, lang], customLanguage: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.name.trim()) {
      setError("Adj meg egy kollekció-nevet.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CardCollectionInsert = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_id: form.template_id || null,
      languages: form.languages,
    };
    const { data, error: insertError } = await supabase.from("card_collections").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a kollekciót."));
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mb-5 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kollekció neve *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder='pl. "Pear Edition"'
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Használt sablon</label>
          <select
            className="select"
            value={form.template_id}
            onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
          >
            <option value="">— Nincs kiválasztva —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Leírás / koncepció</label>
        <textarea
          className="textarea min-h-16"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Rövid koncepció, mi ez a kollekció…"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Nyelvek</label>
        <div className="flex flex-wrap items-center gap-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLanguage(lang)}
              className={`badge cursor-pointer border ${
                form.languages.includes(lang) ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
              }`}
            >
              {lang}
            </button>
          ))}
          {form.languages
            .filter((l) => !(LANGUAGE_OPTIONS as readonly string[]).includes(l))
            .map((lang) => (
              <span key={lang} className="badge flex items-center gap-1 border border-bronze bg-bronze text-white">
                {lang}
                <button type="button" onClick={() => toggleLanguage(lang)} aria-label={`${lang} eltávolítása`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          <input
            className="input w-28 !py-1 text-xs"
            value={form.customLanguage}
            onChange={(e) => setForm((f) => ({ ...f, customLanguage: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomLanguage();
              }
            }}
            placeholder="Egyéb…"
          />
          <button type="button" onClick={addCustomLanguage} className="btn btn-ghost !px-2 !py-1 text-xs">
            <Plus size={12} /> Hozzáadás
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Kollekció létrehozása"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}
