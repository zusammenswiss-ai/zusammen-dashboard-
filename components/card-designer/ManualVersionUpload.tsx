"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardCollection, CardExportKind, CardExportVersion } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-designer";

/**
 * Kézi feltöltés — egy korábban, NEM az app tervezőjéből elkészült
 * fájlt (pl. a jelenlegi Pear Edition production-fájljait) rögzít
 * verzióként, hogy az is ugyanabban az előzmény-listában éljen, mint az
 * app saját exportjai. Nincs renderelés, csak feltöltés + metaadat.
 */
export default function ManualVersionUpload({
  collection,
  onCreated,
}: {
  collection: CardCollection;
  onCreated: (v: CardExportVersion) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState(collection.languages[0] ?? "HU");
  const [kind, setKind] = useState<CardExportKind>("fronts_only");
  const [cardCount, setCardCount] = useState("");
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const count = Number(cardCount);
    if (!supabase || !file || !language.trim() || !Number.isFinite(count) || count <= 0) {
      setError("Válassz fájlt, adj meg egy nyelvet és egy pozitív kártyaszámot.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `exports/${collection.id}/${Date.now()}-manual-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const fileUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      const format = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "png";

      const { data, error: insertError } = await supabase
        .from("card_export_versions")
        .insert({
          collection_id: collection.id,
          language: language.trim(),
          kind,
          format,
          card_count: count,
          file_url: fileUrl,
          source: "manual_upload",
          sent_to_manufacturer: sent,
          sent_at: sent ? sentAt : null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
      setShowForm(false);
      setFile(null);
      setCardCount("");
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült feltölteni a fájlt."));
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return (
      <button type="button" onClick={() => setShowForm(true)} className="btn btn-ghost text-xs">
        <Upload size={13} /> Meglévő fájl kézi feltöltése
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <p className="text-xs text-muted">
        Egy korábban elkészült fájlt (pl. a jelenlegi production-fájlokat) rögzít verzióként — nem az alkalmazás
        tervezőjéből készült, de ugyanúgy megjelenik az előzményben, letölthetően.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Fájl *</label>
        <input
          type="file"
          required
          accept="image/*,.zip,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-forest"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nyelv *</label>
          <input
            className="input"
            required
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="pl. HU"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tartalom</label>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as CardExportKind)}>
            <option value="fronts_only">Csak előlapok</option>
            <option value="front_back_pairs">Előlap+hátlap</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kártyák száma *</label>
          <input
            type="number"
            min="1"
            className="input"
            required
            value={cardCount}
            onChange={(e) => setCardCount(e.target.value)}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-forest">
        <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} />
        Gyártónak elküldve
      </label>
      {sent && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Küldés dátuma</label>
          <input type="date" className="input w-auto" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Feltöltés…" : "Verzió mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
          Mégse
        </button>
      </div>
    </form>
  );
}
