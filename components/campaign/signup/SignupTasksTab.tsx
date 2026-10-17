"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Link2, X, ArrowRight } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, TaskItem } from "@/lib/supabase/types";
import QuickTaskModal from "@/components/QuickTaskModal";
import EmptyState from "@/components/EmptyState";
import { ListTodo } from "lucide-react";

/** Feladatok fül — ugyanaz a valódi tasks.signup_id kapcsolat, mint a
 * campaign_id a kampány Feladatok fülén: ugyanaz a rekord látszik itt és
 * a Kanbanon (lásd app/(dashboard)/tasks/page.tsx signupById badge-jét),
 * nem egy duplikált másolat. Meglévő, még szabad (ehhez a kampányhoz
 * tartozó, de jelentkezőhöz nem rendelt) feladat is hozzárendelhető, és
 * egy feladat le is vehető a jelentkezőről. */
export default function SignupTasksTab({
  signup,
  campaignId,
  tasks,
  onChanged,
}: {
  signup: First20Signup;
  campaignId: string | null;
  tasks: TaskItem[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [unassigned, setUnassigned] = useState<TaskItem[]>([]);

  useEffect(() => {
    if (!showPicker || !campaignId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("campaign_id", campaignId)
        .is("signup_id", null)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      setUnassigned(data ?? []);
    })();
  }, [showPicker, campaignId]);

  async function assignTask(taskId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ signup_id: signup.id }).eq("id", taskId);
    if (!error) {
      setShowPicker(false);
      onChanged();
    }
  }

  async function unassignTask(taskId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ signup_id: null }).eq("id", taskId);
    if (!error) onChanged();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowPicker(true)}>
            <Link2 size={14} /> Meglévő feladat hozzárendelése
          </button>
          <button className="btn btn-bronze" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Feladat
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="Még nincs feladat ehhez a jelentkezőhöz" description="Vedd fel az elsőt a '+ Feladat' gombbal." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Link href={`/tasks?open=${t.id}`} className="min-w-0 truncate text-forest hover:text-bronze">
                {t.title}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <span className="badge bg-ivory-dim text-walnut">{t.status}</span>
                <button onClick={() => unassignTask(t.id)} className="text-muted/70 hover:text-red-600" title="Levétel a jelentkezőről">
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <QuickTaskModal
          heading={`Feladat — ${signup.first_name}`}
          extraFields={{
            category: "Marketing",
            task_type: "Kampány",
            signup_id: signup.id,
            ...(campaignId ? { campaign_id: campaignId } : {}),
            notes: `First 20 jelentkező — ${signup.email}`,
          }}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            onChanged();
          }}
        />
      )}

      {showPicker && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
          onClick={() => setShowPicker(false)}
        >
          <div className="animate-fade-in card mx-auto w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-white p-4">
              <h3 className="font-serif text-lg text-forest">Meglévő feladat hozzárendelése</h3>
              <button onClick={() => setShowPicker(false)} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim" aria-label="Bezárás">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-b-2xl bg-white p-2">
              {unassigned.length === 0 ? (
                <p className="p-3 text-xs text-muted">Nincs szabad (ehhez a kampányhoz tartozó, jelentkezőhöz még nem rendelt) feladat.</p>
              ) : (
                unassigned.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => assignTask(t.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-ivory-dim"
                  >
                    <span className="truncate">{t.title}</span>
                    <ArrowRight size={13} className="shrink-0 text-muted" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
