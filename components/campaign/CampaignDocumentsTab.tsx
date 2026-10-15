"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Download, FileText, Image as ImageIcon, X, Link2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, Document, MarketingAsset } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const DOCUMENTS_BUCKET = "documents";
const DOCUMENT_TYPES = ["Szöveg", "Vizuál", "Kreatív", "Jelentés", "Szerződés", "Egyéb"];

const EMPTY_FORM = { title: "", category: "Egyéb", version_label: "", link: "", notes: "" };

/** Dokumentumok fül — a kampányhoz tartozó fájlok (documents tábla) és a
 * hozzárendelt Marketing anyagok (képek) egy helyen. Fájl feltölthető,
 * link hozzáadható (a notes mezőbe kerül, nincs külön url oszlop), és
 * meglévő, még kampányhoz nem rendelt anyag ide rendelhető. */
export default function CampaignDocumentsTab({
  campaign,
  documents,
  assets,
  allAssets,
  signedUrls,
  onChanged,
}: {
  campaign: Campaign;
  documents: Document[];
  assets: MarketingAsset[];
  allAssets: MarketingAsset[];
  signedUrls: Map<string, string>;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        filePath = path;
        fileName = file.name;
      }
      const notes = [form.link.trim() ? `Link: ${form.link.trim()}` : null, form.notes.trim() || null]
        .filter(Boolean)
        .join("\n");
      const { error: insertError } = await supabase.from("documents").insert({
        title: form.title.trim(),
        category: form.category,
        version_label: form.version_label.trim() || null,
        notes: notes || null,
        file_path: filePath,
        file_name: fileName,
        campaign_id: campaign.id,
      });
      if (insertError) throw insertError;
      setForm(EMPTY_FORM);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a dokumentumot."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(doc: Document) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (doc.file_path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
    const { error: deleteError } = await supabase.from("documents").delete().eq("id", doc.id);
    if (deleteError) setError(deleteError.message);
    else onChanged();
  }

  async function assignAsset(assetId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: updateError } = await supabase.from("marketing_assets").update({ campaign_id: campaign.id }).eq("id", assetId);
    if (updateError) setError(updateError.message);
    else {
      setShowAssetPicker(false);
      onChanged();
    }
  }

  async function unassignAsset(assetId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: updateError } = await supabase.from("marketing_assets").update({ campaign_id: null }).eq("id", assetId);
    if (updateError) setError(updateError.message);
    else onChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-base text-forest">Fájlok</h3>
          <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} /> Dokumentum hozzáadása
          </button>
        </div>

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        {showForm && (
          <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
                <input className="input" required autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
                <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Verzió-jelölés</label>
                <input className="input" value={form.version_label} onChange={(e) => setForm((f) => ({ ...f, version_label: e.target.value }))} placeholder="pl. v2" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Fájl</label>
                <input ref={fileInputRef} type="file" className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted">Link (opcionális, ha nincs fájl)</label>
                <input className="input" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://…" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
                <textarea className="textarea min-h-16" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
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

        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="Még nincs dokumentum" description="Tölts fel egy fájlt, vagy adj hozzá egy linket." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {documents.map((doc) => {
              const url = doc.file_path ? signedUrls.get(doc.file_path) ?? null : null;
              return (
                <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-forest">{doc.title}</span>
                      {doc.category && <span className="badge bg-ivory-dim text-walnut">{doc.category}</span>}
                      {doc.version_label && <span className="badge bg-bronze/15 text-walnut">{doc.version_label}</span>}
                    </div>
                    {doc.notes && <p className="mt-0.5 truncate text-xs text-muted">{doc.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">{formatDate(doc.created_at)}</span>
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted/70 hover:text-forest" title="Megnyitás">
                        <Download size={13} />
                      </a>
                    )}
                    <button onClick={() => deleteDocument(doc)} className="text-muted/70 hover:text-red-600" title="Törlés">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-base text-forest">Marketing anyagok</h3>
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setShowAssetPicker(true)}>
            <Link2 size={14} /> Meglévő anyag hozzárendelése
          </button>
        </div>
        {assets.length === 0 ? (
          <p className="text-xs text-muted">Még nincs hozzárendelt anyag.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {assets.map((asset) => {
              const imageUrl = signedUrls.get(asset.image_url) ?? null;
              return (
                <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-md bg-ivory-dim">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={asset.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted/40">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => unassignAsset(asset.id)}
                    className="absolute right-1 top-1 hidden rounded-full bg-white/90 p-1 text-muted hover:text-red-600 group-hover:block"
                    title="Hozzárendelés megszüntetése"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showAssetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]" onClick={() => setShowAssetPicker(false)}>
          <div className="animate-fade-in card flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-serif text-lg text-forest">Anyag hozzárendelése</h3>
              <button onClick={() => setShowAssetPicker(false)} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim" aria-label="Bezárás">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {allAssets.length === 0 ? (
                <p className="text-xs text-muted">Nincs szabad (más kampányhoz nem rendelt) anyag.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {allAssets.map((asset) => {
                    const imageUrl = signedUrls.get(asset.image_url) ?? null;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => assignAsset(asset.id)}
                        className="relative aspect-square overflow-hidden rounded-md bg-ivory-dim ring-2 ring-transparent hover:ring-bronze"
                        title={asset.title}
                      >
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt={asset.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted/40">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
