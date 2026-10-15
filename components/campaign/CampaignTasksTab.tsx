"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import type { Campaign, TaskItem, TaskStatus } from "@/lib/supabase/types";
import QuickTaskModal from "@/components/QuickTaskModal";
import EmptyState from "@/components/EmptyState";
import { ListTodo } from "lucide-react";

const COLUMNS: TaskStatus[] = ["Várakozás", "Teendő", "Folyamatban", "Kész"];

/** Feladatok fül — ugyanaz a 4 állapot-oszlop, mint a Kanbanon, csak erre
 * a kampányra szűrve. A "+ Feladat" innen automatikusan a kampányhoz
 * kapcsolódik (campaign_id + task_type "Kampány"), és a központi
 * Feladatok oldalon is megjelenik, kampány-címkével. */
export default function CampaignTasksTab({
  campaign,
  tasks,
  onChanged,
}: {
  campaign: Campaign;
  tasks: TaskItem[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const active = tasks.filter((t) => !t.archived_at);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/tasks?campaign=${campaign.id}`} className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline">
          Megnyitás a Feladatok oldalon <ArrowRight size={12} />
        </Link>
        <button className="btn btn-bronze" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Feladat
        </button>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={ListTodo} title="Még nincs feladat ehhez a kampányhoz" description="Vedd fel az elsőt a '+ Feladat' gombbal." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((status) => {
            const columnTasks = active.filter((t) => t.status === status);
            return (
              <div key={status} className="rounded-lg bg-ivory-dim p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <h4 className="text-xs font-medium text-forest">{status}</h4>
                  <span className="badge bg-white text-walnut">{columnTasks.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {columnTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks?open=${t.id}`}
                      className="block rounded-md bg-white px-2.5 py-2 text-xs text-forest shadow-sm hover:text-bronze"
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

      {showForm && (
        <QuickTaskModal
          heading={`Feladat — ${campaign.name}`}
          extraFields={{ category: "Marketing", task_type: "Kampány", campaign_id: campaign.id }}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
