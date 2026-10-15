"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Target, Archive, Trash2, Lock } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, CampaignStatus, CampaignType, Season } from "@/lib/supabase/types";
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_STYLES, CAMPAIGN_TYPES, CAMPAIGN_CHANNELS, SEASON_HU } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import SearchBar from "@/components/SearchBar";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import NewCampaignModal from "@/components/campaign/NewCampaignModal";

const SEASON_ORDER: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

type TaskSummary = { campaign_id: string | null; status: string; due_date: string | null };

/** Kampányok fül — a Marketing lap mostantól ez alapértelmezetten: minden
 * kampány egy helyen, kártya/tábla nézettel, szűrőkkel, kereséssel, és
 * egy "+ Új kampány" gombbal, ami sablonból indít. */
export default function CampaignsListSection() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [expenseByCampaign, setExpenseByCampaign] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "table">("card");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<CampaignType | "">("");
  const [seasonFilter, setSeasonFilter] = useState<Season | "">("");
  const [channelFilter, setChannelFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<"start_date" | "updated_at">("start_date");
  const [showNewModal, setShowNewModal] = useState(false);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [campaignsRes, tasksRes, expensesRes] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("campaign_id, status, due_date").not("campaign_id", "is", null),
      supabase.from("expenses").select("campaign_id, amount").not("campaign_id", "is", null),
    ]);
    if (campaignsRes.error) setError(campaignsRes.error.message);
    else setCampaigns(campaignsRes.data ?? []);
    if (!tasksRes.error) setTasks(tasksRes.data ?? []);
    if (!expensesRes.error) {
      const map = new Map<string, number>();
      for (const e of expensesRes.data ?? []) {
        if (!e.campaign_id) continue;
        map.set(e.campaign_id, (map.get(e.campaign_id) ?? 0) + e.amount);
      }
      setExpenseByCampaign(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const taskStatsByCampaign = useMemo(() => {
    const map = new Map<string, { done: number; total: number; nextDue: string | null }>();
    for (const t of tasks) {
      if (!t.campaign_id) continue;
      const entry = map.get(t.campaign_id) ?? { done: 0, total: 0, nextDue: null };
      entry.total += 1;
      if (t.status === "Kész") entry.done += 1;
      else if (t.due_date && (!entry.nextDue || t.due_date < entry.nextDue)) entry.nextDue = t.due_date;
      map.set(t.campaign_id, entry);
    }
    return map;
  }, [tasks]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const c of campaigns) {
      if (c.start_date) set.add(c.start_date.slice(0, 4));
    }
    return [...set].sort().reverse();
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns
      .filter((c) => (showArchived ? true : c.status !== "Archivált"))
      .filter((c) => !statusFilter || c.status === statusFilter)
      .filter((c) => !typeFilter || c.type === typeFilter)
      .filter((c) => !seasonFilter || c.season === seasonFilter)
      .filter((c) => !channelFilter || c.channels.includes(channelFilter))
      .filter((c) => !yearFilter || c.start_date?.slice(0, 4) === yearFilter)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.goal ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const key = sortBy;
        const av = a[key] ?? "";
        const bv = b[key] ?? "";
        return bv.localeCompare(av);
      });
  }, [campaigns, query, statusFilter, typeFilter, seasonFilter, channelFilter, yearFilter, showArchived, sortBy]);

  function deleteCampaign(campaign: Campaign) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    scheduleUndo(
      `"${campaign.name}" kampány törölve.`,
      async () => {
        // A campaign_kpis/campaign_log/campaign_partners sorok CASCADE-del
        // törlődnek; a hozzá kapcsolt feladatok/anyagok/tartalmak/kiadások
        // campaign_id-ja null-ra áll (on delete set null) — ők maguk
        // megmaradnak, csak a kampány-kapcsolatuk szakad meg.
        const { error: deleteError } = await supabase.from("campaigns").delete().eq("id", campaign.id);
        if (deleteError) console.error(deleteError.message);
      },
      () => setCampaigns((prev) => [campaign, ...prev.filter((c) => c.id !== campaign.id)])
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <SearchBar value={query} onChange={setQuery} placeholder="Kampányok keresése…" />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
            <select className="select !py-1.5 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")}>
              <option value="">Összes</option>
              {CAMPAIGN_STATUSES.filter((s) => s !== "Archivált").map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
            <select className="select !py-1.5 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CampaignType | "")}>
              <option value="">Összes</option>
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Évszak</label>
            <select className="select !py-1.5 text-xs" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value as Season | "")}>
              <option value="">Összes</option>
              {SEASON_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SEASON_HU[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Csatorna</label>
            <select className="select !py-1.5 text-xs" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="">Összes</option>
              {CAMPAIGN_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
          {years.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Év</label>
              <select className="select !py-1.5 text-xs" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">Összes</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Rendezés</label>
            <select className="select !py-1.5 text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value as "start_date" | "updated_at")}>
              <option value="start_date">Kezdés szerint</option>
              <option value="updated_at">Utolsó módosítás szerint</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`btn !py-1.5 text-xs ${showArchived ? "btn-bronze" : "btn-ghost"}`}
          >
            <Archive size={13} /> Archivált is
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView("card")}
              className={`rounded-l-md px-2.5 py-1.5 ${view === "card" ? "bg-bronze text-white" : "text-muted"}`}
              aria-label="Kártya nézet"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-r-md px-2.5 py-1.5 ${view === "table" ? "bg-bronze text-white" : "text-muted"}`}
              aria-label="Tábla nézet"
            >
              <List size={14} />
            </button>
          </div>
          <button className="btn btn-bronze" onClick={() => setShowNewModal(true)}>
            <Plus size={16} /> Új kampány
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="Nincs ilyen kampány" description="Vedd fel az elsőt a '+ Új kampány' gombbal, vagy módosítsd a szűrőket." />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              taskStats={taskStatsByCampaign.get(c.id)}
              cost={expenseByCampaign.get(c.id) ?? 0}
              onDelete={() => deleteCampaign(c)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-ivory-dim text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Név</th>
                <th className="px-3 py-2 font-medium">Állapot</th>
                <th className="px-3 py-2 font-medium">Időszak</th>
                <th className="px-3 py-2 font-medium">Feladatok</th>
                <th className="px-3 py-2 font-medium">Köv. határidő</th>
                <th className="px-3 py-2 font-medium">Költség</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const stats = taskStatsByCampaign.get(c.id);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-ivory-dim/50">
                    <td className="px-3 py-2">
                      <Link href={`/marketing/kampanyok/${c.slug}`} className="font-medium text-forest hover:text-bronze hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge ${CAMPAIGN_STATUS_STYLES[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {c.start_date ? formatDate(c.start_date) : "…"} – {c.end_date ? formatDate(c.end_date) : "…"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{stats ? `${stats.done}/${stats.total}` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{stats?.nextDue ? formatDate(stats.nextDue) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{(expenseByCampaign.get(c.id) ?? 0).toLocaleString("de-CH")} CHF</td>
                    <td className="px-3 py-2 text-right">
                      {c.is_locked ? (
                        <span title="Rögzítve">
                          <Lock size={13} className="inline text-muted/50" />
                        </span>
                      ) : (
                        <button
                          onClick={() => deleteCampaign(c)}
                          className="text-muted/70 hover:text-red-600"
                          title="Kampány törlése"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNewModal && (
        <NewCampaignModal
          onClose={() => setShowNewModal(false)}
          onCreated={(campaign) => {
            setShowNewModal(false);
            // Egyenesen a részletoldalra, ahol minden fül (Feladatok,
            // Dokumentumok, Tartalom, E-mail, Partnerek, Költségek,
            // Eredmények, Napló) ugyanúgy elérhető, mint a First 20-nál —
            // ne a listára térjünk vissza, ahonnan ezt külön meg kéne
            // keresni.
            if (campaign.slug) router.push(`/marketing/kampanyok/${campaign.slug}`);
            else void load();
          }}
        />
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function CampaignCard({
  campaign,
  taskStats,
  cost,
  onDelete,
}: {
  campaign: Campaign;
  taskStats: { done: number; total: number; nextDue: string | null } | undefined;
  cost: number;
  onDelete: () => void;
}) {
  return (
    <Link href={`/marketing/kampanyok/${campaign.slug}`} className="card group relative flex flex-col gap-2 p-4 hover:border-bronze/40">
      {campaign.is_locked ? (
        <span className="absolute right-3 top-3" title="Rögzítve">
          <Lock size={13} className="text-muted/50" />
        </span>
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-3 top-3 text-muted/40 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
          title="Kampány törlése"
        >
          <Trash2 size={13} />
        </button>
      )}
      <div className="flex items-start justify-between gap-2 pr-5">
        <h3 className="font-serif text-lg text-forest">{campaign.name}</h3>
        <span className={`badge shrink-0 ${CAMPAIGN_STATUS_STYLES[campaign.status]}`}>{campaign.status}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge bg-ivory-dim text-walnut">{campaign.type}</span>
        {campaign.season && <span className="badge bg-ivory-dim text-walnut">{SEASON_HU[campaign.season]}</span>}
      </div>
      {campaign.goal && <p className="line-clamp-2 text-sm text-muted">{campaign.goal}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted">
        <span>
          {campaign.start_date ? formatDate(campaign.start_date) : "…"} – {campaign.end_date ? formatDate(campaign.end_date) : "…"}
        </span>
        <span>{taskStats ? `${taskStats.done}/${taskStats.total} feladat` : "0 feladat"}</span>
      </div>
      {(taskStats?.nextDue || cost > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          {taskStats?.nextDue && <span>Köv. határidő: {formatDate(taskStats.nextDue)}</span>}
          {cost > 0 && <span>{cost.toLocaleString("de-CH")} CHF</span>}
        </div>
      )}
    </Link>
  );
}
