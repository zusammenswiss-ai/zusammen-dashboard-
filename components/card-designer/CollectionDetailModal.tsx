"use client";

import { useState } from "react";
import { X, Trash2, Plus, Pencil, Wand2, Check, Palette } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  CardCollection,
  CardExportVersion,
  CardTemplate,
  CollectionCard,
  CollectionCardInsert,
  CollectionCardType,
} from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import EmptyState from "@/components/EmptyState";
import StickyFormActions from "@/components/StickyFormActions";
import CardCanvasEditor, { type CardDesign } from "@/components/card-designer/CardCanvasEditor";
import ExportPanel from "@/components/card-designer/ExportPanel";
import VersionHistoryList from "@/components/card-designer/VersionHistoryList";
import CollectionGallery from "@/components/card-designer/CollectionGallery";
import ManualVersionUpload from "@/components/card-designer/ManualVersionUpload";
import { errorMessage } from "@/lib/errors";
import { suggestCardNumber, textForLanguage } from "@/lib/card-template";
import { CARD_COLLECTION_STATUSES, CARD_COLLECTION_STATUS_STYLES, COLLECTION_CARD_TYPES, LANGUAGE_OPTIONS } from "@/lib/labels";

function bySortOrder(a: CollectionCard, b: CollectionCard) {
  return a.sort_order - b.sort_order;
}

/** Kollekció részletes nézete — szerkeszthető adatok (állapot, sablon,
 * nyelvek) + a hozzá tartozó kártyalista CRUD-ja. Ugyanaz a fejléc/
 * görgethető-törzs/rögzített-lábléc szerkezet, mint minden más modalban
 * ebben az appban (lásd CampaignDetailModal). */
export default function CollectionDetailModal({
  collection,
  templates,
  cards,
  exportVersions,
  onClose,
  onCollectionSaved,
  onCardsChange,
  onExportVersionsChange,
  onDelete,
}: {
  collection: CardCollection;
  templates: CardTemplate[];
  cards: CollectionCard[];
  exportVersions: CardExportVersion[];
  onClose: () => void;
  onCollectionSaved: (c: CardCollection) => void;
  onCardsChange: (nextForCollection: CollectionCard[]) => void;
  onExportVersionsChange: (nextForCollection: CardExportVersion[]) => void;
  onDelete: () => void;
}) {
  const [meta, setMeta] = useState({
    name: collection.name,
    description: collection.description ?? "",
    status: collection.status,
    template_id: collection.template_id ?? "",
    languages: collection.languages,
    customLanguage: "",
  });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [designCardId, setDesignCardId] = useState<string | null>(null);
  const [showBackEditor, setShowBackEditor] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === meta.template_id) ?? null;
  const designCard = designCardId ? cards.find((c) => c.id === designCardId) ?? null : null;

  function toggleLanguage(lang: string) {
    setMeta((f) => ({
      ...f,
      languages: f.languages.includes(lang) ? f.languages.filter((l) => l !== lang) : [...f.languages, lang],
    }));
  }

  function addCustomLanguage() {
    const lang = meta.customLanguage.trim().toUpperCase();
    if (!lang || meta.languages.includes(lang)) return;
    setMeta((f) => ({ ...f, languages: [...f.languages, lang], customLanguage: "" }));
  }

  async function saveMeta() {
    const supabase = getSupabaseClient();
    if (!supabase || !meta.name.trim()) {
      setMetaError("Adj meg egy kollekció-nevet.");
      return;
    }
    setMetaSaving(true);
    setMetaError(null);
    const { data, error } = await supabase
      .from("card_collections")
      .update({
        name: meta.name.trim(),
        description: meta.description.trim() || null,
        status: meta.status,
        template_id: meta.template_id || null,
        languages: meta.languages,
      })
      .eq("id", collection.id)
      .select()
      .single();
    setMetaSaving(false);
    if (error) {
      setMetaError(errorMessage(error, "Nem sikerült menteni a kollekciót."));
      return;
    }
    if (data) onCollectionSaved(data);
  }

  async function saveCardDesign(card: CollectionCard, design: CardDesign) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("collection_cards")
      .update({
        background_color: design.background_color,
        image_url: design.image_url,
        image_x: design.image_x,
        image_y: design.image_y,
        image_scale: design.image_scale,
        text_font_size: design.text_font_size,
        text_align: design.text_align,
      })
      .eq("id", card.id)
      .select()
      .single();
    if (error) throw error;
    if (data) onCardsChange(cards.map((x) => (x.id === data.id ? data : x)));
  }

  async function saveBackDesign(design: CardDesign) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("card_collections")
      .update({
        back_background_color: design.background_color,
        back_image_url: design.image_url,
        back_image_x: design.image_x,
        back_image_y: design.image_y,
        back_image_scale: design.image_scale,
      })
      .eq("id", collection.id)
      .select()
      .single();
    if (error) throw error;
    if (data) onCollectionSaved(data);
  }

  function deleteCard(card: CollectionCard) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (editingCardId === card.id) setEditingCardId(null);
    onCardsChange(cards.filter((c) => c.id !== card.id));
    void supabase
      .from("collection_cards")
      .delete()
      .eq("id", card.id)
      .then(({ error }) => {
        if (error) console.error(error.message);
      });
  }

  const sortedCards = [...cards].sort(bySortOrder);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <BackButton onClick={onClose} label="Vissza a kollekciókhoz" />
            <h2 className="font-serif text-xl text-forest">{collection.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-6">
            <p className="mb-3 font-serif text-lg text-forest">Galéria</p>
            <CollectionGallery template={selectedTemplate} cards={cards} languages={meta.languages} />
          </div>

          <div className="mb-6 rounded-lg border border-border p-4">
            <p className="mb-3 text-xs font-medium text-bronze">Kollekció adatai</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Kollekció neve *</label>
                <input
                  className="input"
                  required
                  value={meta.name}
                  onChange={(e) => setMeta((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
                <select
                  className={`select ${CARD_COLLECTION_STATUS_STYLES[meta.status]}`}
                  value={meta.status}
                  onChange={(e) => setMeta((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                >
                  {CARD_COLLECTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted">Használt sablon</label>
                <select
                  className="select"
                  value={meta.template_id}
                  onChange={(e) => setMeta((f) => ({ ...f, template_id: e.target.value }))}
                >
                  <option value="">— Nincs kiválasztva —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted">Leírás / koncepció</label>
                <textarea
                  className="textarea min-h-16"
                  value={meta.description}
                  onChange={(e) => setMeta((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted">Nyelvek</label>
                <div className="flex flex-wrap items-center gap-2">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`badge cursor-pointer border ${
                        meta.languages.includes(lang)
                          ? "border-bronze bg-bronze text-white"
                          : "border-border bg-white text-muted"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                  {meta.languages
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
                    value={meta.customLanguage}
                    onChange={(e) => setMeta((f) => ({ ...f, customLanguage: e.target.value }))}
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
            </div>
            {metaError && <p className="mt-3 text-xs text-red-600">{metaError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveMeta()} disabled={metaSaving} className="btn btn-primary">
                <Check size={14} /> {metaSaving ? "Mentés…" : "Adatok mentése"}
              </button>
              <button
                type="button"
                onClick={() => setShowBackEditor(true)}
                disabled={!selectedTemplate}
                title={selectedTemplate ? undefined : "Előbb válassz sablont"}
                className="btn btn-ghost"
              >
                <Palette size={14} /> Hátlap szerkesztése
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="font-serif text-lg text-forest">Kártyák</p>
            <button
              type="button"
              className="btn btn-bronze !px-3 !py-1.5 text-xs"
              onClick={() => {
                setEditingCardId(null);
                setShowCardForm((v) => !v);
              }}
            >
              <Plus size={14} /> Új kártya
            </button>
          </div>

          {showCardForm && (
            <CardForm
              collectionId={collection.id}
              languages={meta.languages}
              existingCards={cards}
              onCreated={(c) => {
                onCardsChange([...cards, c]);
                setShowCardForm(false);
              }}
              onCancel={() => setShowCardForm(false)}
            />
          )}

          {sortedCards.length === 0 ? (
            <EmptyState
              icon={Pencil}
              title="Még nincs kártya ebben a kollekcióban"
              description="Add hozzá az első kártyát — azonosítót, típust és a nyelvenkénti szöveget."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {sortedCards.map((c) =>
                editingCardId === c.id ? (
                  <CardEditRow
                    key={c.id}
                    card={c}
                    languages={meta.languages}
                    onSaved={(saved) => {
                      onCardsChange(cards.map((x) => (x.id === saved.id ? saved : x)));
                      setEditingCardId(null);
                    }}
                    onCancel={() => setEditingCardId(null)}
                  />
                ) : (
                  <CardRow
                    key={c.id}
                    card={c}
                    canDesign={Boolean(selectedTemplate)}
                    onEdit={() => {
                      setShowCardForm(false);
                      setEditingCardId(c.id);
                    }}
                    onDesign={() => setDesignCardId(c.id)}
                    onDelete={() => deleteCard(c)}
                  />
                )
              )}
            </div>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 font-serif text-lg text-forest">Exportálás &amp; verziók</p>
            {selectedTemplate ? (
              <ExportPanel
                collection={collection}
                template={selectedTemplate}
                cards={cards}
                onVersionCreated={(v) => onExportVersionsChange([...exportVersions, v])}
              />
            ) : (
              <p className="text-xs text-muted">Válassz sablont a kollekciónak az app saját exportálásához.</p>
            )}
            <div className="mt-3">
              <ManualVersionUpload
                collection={collection}
                onCreated={(v) => onExportVersionsChange([...exportVersions, v])}
              />
            </div>
            <div className="mt-4">
              <VersionHistoryList versions={exportVersions} templates={templates} onVersionsChange={onExportVersionsChange} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <button onClick={onDelete} className="btn btn-danger" aria-label="Kollekció törlése">
            <Trash2 size={15} /> Kollekció törlése
          </button>
          <button onClick={onClose} className="btn btn-ghost">
            Bezárás
          </button>
        </div>
      </div>

      {designCard && selectedTemplate && (
        <CardCanvasEditor
          template={selectedTemplate}
          title={`Kártya tervezése — ${designCard.card_number}`}
          showText
          previewTexts={
            meta.languages.length > 0
              ? meta.languages
                  .filter((lang) => lang === "HU" || lang === "DE" || lang === "EN")
                  .map((lang) => ({ code: lang, text: textForLanguage(designCard, lang) }))
              : [{ code: "Szöveg", text: designCard.text_hu ?? "" }]
          }
          design={{
            background_color: designCard.background_color,
            image_url: designCard.image_url,
            image_x: designCard.image_x,
            image_y: designCard.image_y,
            image_scale: designCard.image_scale,
            text_font_size: designCard.text_font_size,
            text_align: designCard.text_align,
          }}
          onSave={(design) => saveCardDesign(designCard, design)}
          onClose={() => setDesignCardId(null)}
        />
      )}

      {showBackEditor && selectedTemplate && (
        <CardCanvasEditor
          template={selectedTemplate}
          title="Hátlap tervezése"
          showText={false}
          previewTexts={[]}
          design={{
            background_color: collection.back_background_color,
            image_url: collection.back_image_url,
            image_x: collection.back_image_x,
            image_y: collection.back_image_y,
            image_scale: collection.back_image_scale,
            text_font_size: 48,
            text_align: "center",
          }}
          onSave={saveBackDesign}
          onClose={() => setShowBackEditor(false)}
        />
      )}
    </div>
  );
}

function CardRow({
  card,
  canDesign,
  onEdit,
  onDesign,
  onDelete,
}: {
  card: CollectionCard;
  canDesign: boolean;
  onEdit: () => void;
  onDesign: () => void;
  onDelete: () => void;
}) {
  const firstText = card.text_hu || card.text_de || card.text_en || "";
  return (
    <div
      onClick={onEdit}
      className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-bronze/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge bg-ivory-dim text-walnut">{card.card_number}</span>
          <span className="badge bg-bronze/10 text-walnut">{card.card_type}</span>
          {card.suit && <span className="badge bg-ivory-dim text-walnut">{card.suit}</span>}
          {card.background_color && (
            <span
              className="inline-block h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: card.background_color }}
              title="Design elmentve"
            />
          )}
        </div>
        {firstText && <p className="mt-1 line-clamp-1 text-xs text-muted">{firstText}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDesign();
          }}
          disabled={!canDesign}
          title={canDesign ? "Vizuális tervezés" : "Előbb válassz sablont a kollekciónak"}
          className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest disabled:opacity-30"
          aria-label="Vizuális tervezés"
        >
          <Palette size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
          aria-label="Szerkesztés"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-red-600"
          aria-label="Törlés"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function emptyCardForm() {
  return { card_number: "", suit: "", card_type: "Kérdés" as CollectionCardType, text_hu: "", text_de: "", text_en: "" };
}

function cardFormFields({
  form,
  setForm,
  languages,
  existingCards,
}: {
  form: ReturnType<typeof emptyCardForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyCardForm>>>;
  languages: string[];
  existingCards: { card_number: string; card_type: CollectionCardType }[];
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Azonosító / sorszám *</label>
          <div className="flex gap-1.5">
            <input
              className="input"
              required
              autoFocus
              value={form.card_number}
              onChange={(e) => setForm((f) => ({ ...f, card_number: e.target.value }))}
              placeholder='pl. "A", "2", "Wild Card 1"'
            />
            <button
              type="button"
              title="Automatikus azonosító javaslat"
              onClick={() => setForm((f) => ({ ...f, card_number: suggestCardNumber(existingCards, f.card_type) }))}
              className="btn btn-ghost !px-2"
            >
              <Wand2 size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kategória / szín</label>
          <input
            className="input"
            value={form.suit}
            onChange={(e) => setForm((f) => ({ ...f, suit: e.target.value }))}
            placeholder="pl. Kör, Treff…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
          <select
            className="select"
            value={form.card_type}
            onChange={(e) => setForm((f) => ({ ...f, card_type: e.target.value as CollectionCardType }))}
          >
            {COLLECTION_CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      {languages.length === 0 ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Szöveg</label>
          <textarea
            className="textarea min-h-16"
            value={form.text_hu}
            onChange={(e) => setForm((f) => ({ ...f, text_hu: e.target.value }))}
            placeholder="A kártya kérdése / szövege…"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {languages.includes("HU") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Szöveg (HU)</label>
              <textarea
                className="textarea min-h-16"
                value={form.text_hu}
                onChange={(e) => setForm((f) => ({ ...f, text_hu: e.target.value }))}
              />
            </div>
          )}
          {languages.includes("DE") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Szöveg (DE)</label>
              <textarea
                className="textarea min-h-16"
                value={form.text_de}
                onChange={(e) => setForm((f) => ({ ...f, text_de: e.target.value }))}
              />
            </div>
          )}
          {languages.includes("EN") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Szöveg (EN)</label>
              <textarea
                className="textarea min-h-16"
                value={form.text_en}
                onChange={(e) => setForm((f) => ({ ...f, text_en: e.target.value }))}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CardForm({
  collectionId,
  languages,
  existingCards,
  onCreated,
  onCancel,
}: {
  collectionId: string;
  languages: string[];
  existingCards: CollectionCard[];
  onCreated: (c: CollectionCard) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(emptyCardForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.card_number.trim()) {
      setError("Adj meg egy azonosítót/sorszámot.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CollectionCardInsert = {
      collection_id: collectionId,
      card_number: form.card_number.trim(),
      suit: form.suit.trim() || null,
      card_type: form.card_type,
      text_hu: form.text_hu.trim() || null,
      text_de: form.text_de.trim() || null,
      text_en: form.text_en.trim() || null,
      sort_order: existingCards.length,
    };
    const { data, error: insertError } = await supabase.from("collection_cards").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a kártyát."));
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      {cardFormFields({ form, setForm, languages, existingCards })}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <StickyFormActions>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Kártya mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </StickyFormActions>
    </form>
  );
}

function CardEditRow({
  card,
  languages,
  onSaved,
  onCancel,
}: {
  card: CollectionCard;
  languages: string[];
  onSaved: (c: CollectionCard) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    card_number: card.card_number,
    suit: card.suit ?? "",
    card_type: card.card_type,
    text_hu: card.text_hu ?? "",
    text_de: card.text_de ?? "",
    text_en: card.text_en ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.card_number.trim()) {
      setError("Adj meg egy azonosítót/sorszámot.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("collection_cards")
      .update({
        card_number: form.card_number.trim(),
        suit: form.suit.trim() || null,
        card_type: form.card_type,
        text_hu: form.text_hu.trim() || null,
        text_de: form.text_de.trim() || null,
        text_en: form.text_en.trim() || null,
      })
      .eq("id", card.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a kártyát."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form
      onSubmit={save}
      className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4"
    >
      {cardFormFields({ form, setForm, languages, existingCards: [] })}
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
