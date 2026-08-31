"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Lock, Unlock, Check, ArrowRight, ImageIcon } from "lucide-react";
import type { Campaign, CampaignStatus, MarketingAsset, MarketingContent, TaskStatus } from "@/lib/supabase/types";
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_STYLES, SEASON_HU } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import Lightbox from "@/components/Lightbox";
import BackButton from "@/components/BackButton";

const TASK_STATUS_COLUMNS: TaskStatus[] = ["Teendő", "Folyamatban", "Kész"];

// Lightweight shape — this modal only needs enough to render the mini
// Kanban, not the full TaskItem; the Feladatok oldal owns everything
// else about these rows.
export type CampaignTaskRef = { id: string; title: string; status: TaskStatus };

/** Kampány részletes nézet — opened from a kampány kártya on either the
 * Marketing oldal (Évszakos stratégia season card, or a Tartalom-naptár
 * item's badge) or via the /marketing?campaign=<id> deep link a Feladatok
 * Kanban card's kampány-badge jumps to. Shows the kampány's own adatok
 * (lightly editable, same locked/unlocked convention as CampaignCard),
 * a status-grouped mini Kanban of its linked Feladatok, and any linked
 * Marketing tartalom / anyagok. */
export default function CampaignDetailModal({
  campaign,
  tasks,
  content,
  assetById,
  onClose,
  onUpdate,
}: {
  campaign: Campaign;
  tasks: CampaignTaskRef[];
  content: MarketingContent[];
  assetById: Map<string, MarketingAsset>;
  onClose: () => void;
  onUpdate: (patch: Partial<Campaign>) => void;
}) {
  const [locked, setLocked] = useState(true);
  const [draft, setDraft] = useState({
    status: campaign.status,
    start_date: campaign.start_date ?? "",
    end_date: campaign.end_date ?? "",
    description: campaign.description ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [lightboxAsset, setLightboxAsset] = useState<MarketingAsset | null>(null);

  function unlock() {
    setDraft({
      status: campaign.status,
      start_date: campaign.start_date ?? "",
      end_date: campaign.end_date ?? "",
      description: campaign.description ?? "",
    });
    setLocked(false);
  }

  function commitAndLock() {
    onUpdate({
      status: draft.status,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      description: draft.description.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setLocked(true);
  }

  // Every marketing_content row this kampány owns, resolved down to its
  // saved asset (via the content's own asset_id — see the schema comment
  // on that column) so "Marketing anyagok" never needs a redundant direct
  // campaign_id on marketing_assets itself. Deduped since more than one
  // content item can point at the same reusable asset.
  const assets: MarketingAsset[] = [];
  const seenAssetIds = new Set<string>();
  for (const item of content) {
    if (!item.asset_id || seenAssetIds.has(item.asset_id)) continue;
    const asset = assetById.get(item.asset_id);
    if (asset) {
      seenAssetIds.add(item.asset_id);
      assets.push(asset);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <BackButton onClick={onClose} label="Vissza a Marketinghez" />
            <h2 className="font-serif text-xl text-forest">{campaign.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`badge ${CAMPAIGN_STATUS_STYLES[campaign.status]}`}>{campaign.status}</span>
              {campaign.season && <span className="badge bg-ivory-dim text-walnut">{SEASON_HU[campaign.season]}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs font-medium text-forest">
                <Check size={13} /> Mentve
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
              aria-label="Bezárás"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5">
            {locked ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Kezdés</label>
                    <p className="rounded-md bg-ivory-dim px-3 py-2 text-forest">
                      {campaign.start_date ? formatDate(campaign.start_date) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Vége</label>
                    <p className="rounded-md bg-ivory-dim px-3 py-2 text-forest">
                      {campaign.end_date ? formatDate(campaign.end_date) : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
                  <p className="whitespace-pre-wrap rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
                    {campaign.description || <span className="text-muted">Nincs megadva</span>}
                  </p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={unlock} className="btn btn-ghost text-xs">
                    <Lock size={13} /> Feloldás szerkesztéshez
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
                    <select
                      className="select"
                      value={draft.status}
                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as CampaignStatus }))}
                    >
                      {CAMPAIGN_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Kezdés</label>
                    <input
                      type="date"
                      className="input"
                      value={draft.start_date}
                      onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Vége</label>
                    <input
                      type="date"
                      className="input"
                      value={draft.end_date}
                      onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
                  <textarea
                    className="textarea min-h-20"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Rövid összefoglaló, mi ez a kampány…"
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setLocked(true)} className="btn btn-ghost text-xs">
                    Mégse
                  </button>
                  <button onClick={commitAndLock} className="btn btn-bronze text-xs">
                    <Unlock size={13} /> Rögzítés
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mb-5 border-t border-border pt-4">
            <h3 className="mb-2 font-serif text-base text-forest">Feladatok</h3>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted">Még nincs feladat ehhez a kampányhoz.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {TASK_STATUS_COLUMNS.map((status) => {
                  const columnTasks = tasks.filter((t) => t.status === status);
                  return (
                    <div key={status} className="rounded-lg bg-ivory-dim p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                        <h4 className="text-xs font-medium text-forest">{status}</h4>
                        <span className="badge bg-white text-walnut">{columnTasks.length}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {columnTasks.map((t) => (
                          <Link
                            key={t.id}
                            href={`/tasks?open=${t.id}`}
                            className="block rounded-md bg-white px-2 py-1.5 text-xs text-forest shadow-sm hover:text-bronze"
                          >
                            {t.title}
                          </Link>
                        ))}
                        {columnTasks.length === 0 && <p className="px-0.5 text-[11px] text-muted">—</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {content.length > 0 && (
            <div className="mb-5 border-t border-border pt-4">
              <h3 className="mb-2 font-serif text-base text-forest">Marketing tartalom</h3>
              <div className="flex flex-col gap-1.5">
                {content.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-ivory-dim px-3 py-1.5"
                  >
                    <span className="truncate text-xs font-medium text-forest">{item.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                      {item.content_type}
                      <ArrowRight size={11} />
                      {formatDate(item.scheduled_date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assets.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="mb-2 font-serif text-base text-forest">Marketing anyagok</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => asset.image_url && setLightboxAsset(asset)}
                    className="block aspect-square overflow-hidden rounded-md bg-ivory-dim"
                    title={asset.title}
                    aria-label={`${asset.title} megnyitása nagyban`}
                  >
                    {asset.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.image_url} alt={asset.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted/40">
                        <ImageIcon size={18} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {lightboxAsset?.image_url && (
        <Lightbox src={lightboxAsset.image_url} alt={lightboxAsset.title} onClose={() => setLightboxAsset(null)} />
      )}
    </div>
  );
}
