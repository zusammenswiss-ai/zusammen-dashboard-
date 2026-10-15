"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListTodo, LineChart, NotebookPen } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, CampaignKpi, CampaignLogEntry, TaskItem } from "@/lib/supabase/types";
import { formatDate } from "@/lib/format";
import { Spinner } from "@/components/Feedback";

type Tab =
  | "overview"
  | "tasks"
  | "documents"
  | "content"
  | "email"
  | "partners"
  | "costs"
  | "kpis"
  | "log"
  | "signups";

/** Áttekintés fül — cél, KPI-kártyák, legutóbbi napló, következő
 * feladatok egy pillantásra, mindegyik a saját füléhez linkelve. */
export default function CampaignOverviewTab({
  campaign,
  tasks,
  taskDone,
  taskTotal,
  onOpenTab,
}: {
  campaign: Campaign;
  tasks: TaskItem[];
  taskDone: number;
  taskTotal: number;
  onOpenTab: (tab: Tab) => void;
}) {
  const [kpis, setKpis] = useState<CampaignKpi[]>([]);
  const [logEntries, setLogEntries] = useState<CampaignLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    (async () => {
      setLoading(true);
      const [kpisRes, logRes] = await Promise.all([
        supabase.from("campaign_kpis").select("*").eq("campaign_id", campaign.id).order("created_at"),
        supabase
          .from("campaign_log")
          .select("*")
          .eq("campaign_id", campaign.id)
          .order("entry_date", { ascending: false })
          .limit(3),
      ]);
      if (!kpisRes.error) setKpis(kpisRes.data ?? []);
      if (!logRes.error) setLogEntries(logRes.data ?? []);
      setLoading(false);
    })();
  }, [campaign.id]);

  const upcomingTasks = tasks
    .filter((t) => !t.archived_at && t.status !== "Kész" && t.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-muted">Feladatok készültsége</p>
          <p className="mt-1 font-serif text-2xl text-forest">
            {taskDone} / {taskTotal}
          </p>
          <button onClick={() => onOpenTab("tasks")} className="mt-2 flex items-center gap-1 text-xs text-bronze hover:underline">
            Megnyitás <ArrowRight size={11} />
          </button>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-muted">Tervezett büdzsé</p>
          <p className="mt-1 font-serif text-2xl text-forest">
            {campaign.budget_planned != null ? `CHF ${campaign.budget_planned.toLocaleString("de-CH")}` : "—"}
          </p>
          <button onClick={() => onOpenTab("costs")} className="mt-2 flex items-center gap-1 text-xs text-bronze hover:underline">
            Költségek <ArrowRight size={11} />
          </button>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-muted">KPI-k</p>
          <p className="mt-1 font-serif text-2xl text-forest">{kpis.length}</p>
          <button onClick={() => onOpenTab("kpis")} className="mt-2 flex items-center gap-1 text-xs text-bronze hover:underline">
            Eredmények <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {kpis.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-base text-forest">
            <LineChart size={15} className="text-bronze" /> KPI-állapot
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => {
              const pct = kpi.target ? Math.min(100, Math.round((kpi.current_value / kpi.target) * 100)) : null;
              return (
                <div key={kpi.id} className="rounded-md bg-ivory-dim p-3">
                  <p className="text-xs font-medium text-walnut">{kpi.name}</p>
                  <p className="mt-1 font-serif text-lg text-forest">
                    {kpi.current_value}
                    {kpi.unit ? ` ${kpi.unit}` : ""}
                    {kpi.target != null && <span className="text-sm text-muted"> / {kpi.target}</span>}
                  </p>
                  {pct != null && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white">
                      <div className="h-full bg-bronze" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-base text-forest">
            <ListTodo size={15} className="text-bronze" /> Következő feladatok
          </h3>
          {upcomingTasks.length === 0 ? (
            <p className="text-xs text-muted">Nincs határidős feladat.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {upcomingTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks?open=${t.id}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-ivory-dim px-3 py-2 text-xs hover:bg-ivory-dim/70"
                >
                  <span className="truncate font-medium text-forest">{t.title}</span>
                  <span className="shrink-0 text-muted">{formatDate(t.due_date)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-base text-forest">
            <NotebookPen size={15} className="text-bronze" /> Legutóbbi napló
          </h3>
          {logEntries.length === 0 ? (
            <p className="text-xs text-muted">Még nincs naplóbejegyzés.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {logEntries.map((entry) => (
                <div key={entry.id} className="rounded-md bg-ivory-dim px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge bg-white text-walnut">{entry.type}</span>
                    <span className="text-[11px] text-muted">{formatDate(entry.entry_date)}</span>
                  </div>
                  <p className="mt-1 text-xs text-forest">{entry.text}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onOpenTab("log")} className="mt-2 flex items-center gap-1 text-xs text-bronze hover:underline">
            Teljes napló <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
