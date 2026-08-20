"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Download, Trash2, ListPlus, ImageOff, ArrowRight } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardAsset } from "@/lib/supabase/types";
import { PRINT_STATUS_STYLES, CARD_ASSET_THUMB_SLOTS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

/** Full detail view for one card-asset version — opened from a Kártya-fájlok
 * list row. Shows the full (untruncated) notes and lets you spin a Feladat
 * off of it, which then shows up on the Feladatok board like any other. */
export default function CardAssetDetailModal({
  asset,
  supplierName,
  onClose,
  onDelete,
}: {
  asset: CardAsset;
  supplierName: string | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !taskTitle.trim()) return;
    setCreatingTask(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: taskTitle.trim(),
        category: "Kártya-fájl",
        status: "Teendő",
        notes: `Kártya-fájl: ${asset.language} — ${asset.version}\n${asset.file_url}`,
      })
      .select()
      .single();
    setCreatingTask(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) setCreatedTaskId(data.id);
    setShowTaskForm(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl text-forest">
                {asset.language} — {asset.version}
              </h2>
              <span className={`badge ${PRINT_STATUS_STYLES[asset.print_status]}`}>
                {asset.print_status}
              </span>
            </div>
            {supplierName && <p className="mt-1 text-xs text-muted">Beszállító: {supplierName}</p>}
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
          <div className="grid grid-cols-4 gap-2">
            {CARD_ASSET_THUMB_SLOTS.map((slot) => {
              const url = asset.thumbnails.find((t) => t.label === slot.key)?.url;
              return (
                <div key={slot.key} className="flex flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-forest/5">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={slot.label} className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff size={16} className="text-muted/40" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted">{slot.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted">Rendelés dátuma</p>
              <p className="text-forest">{formatDate(asset.order_date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Mennyiség</p>
              <p className="text-forest">{asset.quantity != null ? `${asset.quantity} db` : "—"}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-muted">Megjegyzés</p>
            <p className="whitespace-pre-wrap rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
              {asset.notes || <span className="text-muted">Nincs megjegyzés</span>}
            </p>
          </div>

          <p className="mt-4 text-xs text-muted">Feltöltve: {formatDate(asset.created_at)}</p>

          <div className="mt-5 border-t border-border pt-4">
            {createdTaskId ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-forest/5 px-3 py-2 text-sm">
                <span className="text-forest">✓ Feladat létrehozva</span>
                <Link
                  href={`/tasks?open=${createdTaskId}`}
                  className="flex items-center gap-1 font-medium text-bronze hover:underline"
                >
                  Megnyitás a Feladatoknál <ArrowRight size={13} />
                </Link>
              </div>
            ) : showTaskForm ? (
              <form onSubmit={createTask} className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">
                  Mi a teendő ezzel a kártya-fájllal?
                </label>
                <input
                  className="input"
                  required
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="pl. Nyomdai ajánlat bekérése erre a verzióra"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={creatingTask} className="btn btn-primary">
                    {creatingTask ? "Létrehozás…" : "Feladat létrehozása"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowTaskForm(false)}>
                    Mégse
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowTaskForm(true)}>
                <ListPlus size={15} /> Feladat létrehozása ebből
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <button onClick={onDelete} className="btn btn-danger" aria-label="Kártya-fájl törlése">
            <Trash2 size={15} /> Törlés
          </button>
          <a
            href={asset.file_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn btn-primary"
          >
            <Download size={15} /> Letöltés
          </a>
        </div>
      </div>
    </div>
  );
}
