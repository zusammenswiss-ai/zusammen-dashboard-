"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Archive, Download, FileArchive } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CardAsset } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatDate } from "@/lib/format";

const STORAGE_BUCKET = "card-assets";
const LANGUAGES = ["HU", "DE", "EN"];

const EMPTY_FORM = { language: LANGUAGES[0], version: "", notes: "" };

function byRecency(a: CardAsset, b: CardAsset) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

// The uploaded path is `${uuid}-${safeName}` — strip the uuid prefix back
// off for a readable file name in the list.
function fileNameFromUrl(url: string): string {
  const last = decodeURIComponent(url.split("/").pop() ?? "");
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

// We store the full public URL (not just the storage path) per the asset's
// `file_url` column, so deleting from Storage needs the path pulled back
// out of that URL.
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export default function CardAssetsPage() {
  const [assets, setAssets] = useState<CardAsset[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadAssets = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("card_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setAssets(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadAssets();
  }, [supabase, loadAssets]);

  async function addAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.version.trim() || !file) return;
    setSaving(true);
    setError(null);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const fileUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

      const { data, error: insertError } = await supabase
        .from("card_assets")
        .insert({
          language: form.language,
          version: form.version.trim(),
          file_url: fileUrl,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      if (data) setAssets((prev) => [data, ...prev]);
      setForm(EMPTY_FORM);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült feltölteni a fájlt.");
    } finally {
      setSaving(false);
    }
  }

  function deleteAsset(asset: CardAsset) {
    if (!supabase) return;
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    scheduleUndo(
      `"${asset.version}" (${asset.language}) törölve.`,
      async () => {
        const path = storagePathFromUrl(asset.file_url);
        if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
        const { error } = await supabase.from("card_assets").delete().eq("id", asset.id);
        if (error) setError(error.message);
      },
      () => setAssets((prev) => [...prev, asset].sort(byRecency))
    );
  }

  // Grouped by language — fixed languages first in their usual order, then
  // any others (e.g. from old data) alphabetically — newest version on top
  // within each group, with the top one flagged as the current one.
  const groups = useMemo(() => {
    const byLang = new Map<string, CardAsset[]>();
    for (const asset of assets) {
      const list = byLang.get(asset.language) ?? [];
      list.push(asset);
      byLang.set(asset.language, list);
    }
    const languages = Array.from(byLang.keys()).sort((a, b) => {
      const ai = LANGUAGES.indexOf(a);
      const bi = LANGUAGES.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return languages.map((language) => ({
      language,
      versions: [...byLang.get(language)!].sort(byRecency),
    }));
  }, [assets]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Kártya-fájlok" />
        <EmptyState icon={Archive} title="Csatlakoztasd a Supabase-t a kártya-fájlok kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kártya-fájlok"
        subtitle="Nyomdakész kártya-fájlok, verziózva és nyelvenként csoportosítva."
        action={
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Új verzió feltöltése
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={addAsset} className="card mb-6 flex flex-col gap-3 p-5 animate-fade-in">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nyelv</label>
              <select
                className="select"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Verzió *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="pl. v1.0 — rendszerbetűtípus"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">ZIP-fájl *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                required
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
            <textarea
              className="textarea min-h-20"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Mi változott ebben a verzióban…"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Feltöltés…" : "Feltöltés"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Mégse
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Még nincs feltöltött kártya-fájl"
          description="Töltsd fel az első nyomdakész ZIP-et nyelvenként — a legújabb verzió mindig kiemelve jelenik meg."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ language, versions }) => (
            <div key={language}>
              <h2 className="mb-3 font-serif text-lg text-forest">{language}</h2>
              <div className="flex flex-col gap-3">
                {versions.map((asset, i) => (
                  <div
                    key={asset.id}
                    className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest/5 text-bronze">
                      <FileArchive size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-forest">{asset.version}</p>
                        {i === 0 && <span className="badge bg-forest text-ivory">Legújabb</span>}
                      </div>
                      {asset.notes && <p className="mt-1 line-clamp-2 text-xs text-muted">{asset.notes}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(asset.created_at)} · {fileNameFromUrl(asset.file_url)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={asset.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost !px-2"
                        aria-label="Letöltés"
                      >
                        <Download size={15} />
                      </a>
                      <button
                        onClick={() => deleteAsset(asset)}
                        className="btn btn-danger !px-2"
                        aria-label="Törlés"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}
