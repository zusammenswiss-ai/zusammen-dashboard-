"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Plus, Trash2, Archive, Download, FolderUp, ImageOff } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CardAsset, PrintStatus } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatDate } from "@/lib/format";

const STORAGE_BUCKET = "card-assets";
const LANGUAGES = ["HU", "DE", "EN"];

const PRINT_STATUSES: PrintStatus[] = ["Piszkozat", "Nyomdának elküldve", "Megrendelve", "Megérkezett"];
const PRINT_STATUS_STYLES: Record<PrintStatus, string> = {
  Piszkozat: "bg-gray-200 text-gray-700",
  "Nyomdának elküldve": "bg-yellow-100 text-yellow-800",
  Megrendelve: "bg-blue-100 text-blue-700",
  Megérkezett: "bg-green-100 text-green-700",
};

// Fixed preview slots, filled in by /api/card-assets/process whenever it
// finds a matching filename in the uploaded ZIP.
const THUMB_SLOTS: { key: string; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "wild", label: "Wild" },
  { key: "goldcard", label: "GoldCard" },
];

const EMPTY_FORM = {
  language: LANGUAGES[0],
  version: "",
  notes: "",
  print_status: PRINT_STATUSES[0],
  supplier_id: "",
  order_date: "",
  quantity: "",
};

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
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"file" | "folder">("file");
  const [zipping, setZipping] = useState(false);
  const [folderInfo, setFolderInfo] = useState<{ name: string; count: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      setSuppliers((data ?? []).map((s) => ({ id: s.id, name: s.name })));
    })();
  }, [supabase]);

  function switchSource(next: "file" | "folder") {
    setSource(next);
    setFile(null);
    setFolderInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
    switchSource("file");
  }

  // Storage upload takes one file, so a folder is zipped client-side first
  // (preserving its subfolder structure via webkitRelativePath) and then
  // handled exactly like a regular ZIP pick below — bigger folders will
  // take a moment here since it all happens in the browser.
  async function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setZipping(true);
    setError(null);
    try {
      const zip = new JSZip();
      for (const f of files) {
        const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        zip.file(relPath, f);
      }
      const firstRelPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
      const folderName = firstRelPath?.split("/")[0] || "mappa";
      const blob = await zip.generateAsync({ type: "blob" });
      setFile(new File([blob], `${folderName}.zip`, { type: "application/zip" }));
      setFolderInfo({ name: folderName, count: files.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült tömöríteni a mappát.");
    } finally {
      setZipping(false);
    }
  }

  async function addAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.version.trim()) return;
    if (!file) {
      setError("Válassz egy ZIP-fájlt vagy egy mappát a feltöltéshez.");
      return;
    }
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

      // Best-effort: pulls front/back/wild/goldcard preview thumbnails out
      // of the ZIP server-side. A failure here (e.g. no matching filenames,
      // or the ZIP is unreadable) shouldn't block saving the asset itself —
      // it just means no preview grid for this version.
      let thumbnails: { label: string; url: string }[] = [];
      try {
        const res = await fetch("/api/card-assets/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        const data = await res.json();
        if (res.ok && data.ok) thumbnails = data.thumbnails ?? [];
      } catch {
        // Ignore — thumbnails stay empty.
      }

      const { data, error: insertError } = await supabase
        .from("card_assets")
        .insert({
          language: form.language,
          version: form.version.trim(),
          file_url: fileUrl,
          notes: form.notes.trim() || null,
          print_status: form.print_status,
          supplier_id: form.supplier_id || null,
          order_date: form.order_date || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          thumbnails,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      if (data) setAssets((prev) => [data, ...prev]);
      resetForm();
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

  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);

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
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted">
                  {source === "file" ? "ZIP-fájl *" : "Mappa *"}
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => switchSource("file")}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      source === "file" ? "bg-forest text-ivory" : "text-muted hover:bg-ivory-dim"
                    }`}
                  >
                    ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => switchSource("folder")}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      source === "folder" ? "bg-forest text-ivory" : "text-muted hover:bg-ivory-dim"
                    }`}
                  >
                    Mappa
                  </button>
                </div>
              </div>
              {source === "file" ? (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  required
                  className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              ) : (
                <>
                  <input
                    ref={(el) => {
                      folderInputRef.current = el;
                      // webkitdirectory/directory aren't in React's typed
                      // input attributes, so they're set imperatively here.
                      if (el) {
                        el.setAttribute("webkitdirectory", "");
                        el.setAttribute("directory", "");
                      }
                    }}
                    type="file"
                    multiple
                    className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                    onChange={handleFolderChange}
                  />
                  {zipping && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <FolderUp size={12} className="animate-pulse" /> Tömörítés…
                    </p>
                  )}
                  {!zipping && folderInfo && (
                    <p className="mt-1 text-xs text-forest">
                      ✓ {folderInfo.count} fájl becsomagolva ({folderInfo.name}.zip)
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nyomtatási állapot</label>
              <select
                className="select"
                value={form.print_status}
                onChange={(e) => setForm((f) => ({ ...f, print_status: e.target.value as PrintStatus }))}
              >
                {PRINT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Beszállító</label>
              <select
                className="select"
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              >
                <option value="">— Nincs —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Rendelés dátuma</label>
              <input
                type="date"
                className="input"
                value={form.order_date}
                onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Mennyiség</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="pl. 500"
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
            <button type="submit" disabled={saving || zipping} className="btn btn-primary">
              {saving ? "Feltöltés…" : "Feltöltés"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
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
                    className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
                  >
                    <div className="grid shrink-0 grid-cols-2 gap-1">
                      {THUMB_SLOTS.map((slot) => {
                        const url = asset.thumbnails.find((t) => t.label === slot.key)?.url;
                        return (
                          <div
                            key={slot.key}
                            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-forest/5"
                            title={slot.label}
                          >
                            {url ? (
                              // Plain <img>, not next/image — these are
                              // external Supabase Storage URLs and this is
                              // just a tiny fixed-size preview grid.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={slot.label} className="h-full w-full object-cover" />
                            ) : (
                              <ImageOff size={14} className="text-muted/40" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-forest">{asset.version}</p>
                        {i === 0 && <span className="badge bg-forest text-ivory">Legújabb</span>}
                        <span className={`badge ${PRINT_STATUS_STYLES[asset.print_status]}`}>
                          {asset.print_status}
                        </span>
                      </div>
                      {asset.supplier_id && supplierNameById.get(asset.supplier_id) && (
                        <p className="mt-1 text-xs text-muted">
                          Beszállító: {supplierNameById.get(asset.supplier_id)}
                        </p>
                      )}
                      {asset.notes && <p className="mt-1 line-clamp-2 text-xs text-muted">{asset.notes}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(asset.created_at)} · {fileNameFromUrl(asset.file_url)}
                        {asset.quantity != null && ` · ${asset.quantity} db`}
                        {asset.order_date && ` · rendelve: ${formatDate(asset.order_date)}`}
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
