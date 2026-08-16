"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Lightbulb } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { FuturePlan, PlanStatus } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { PLAN_STATUS_HU } from "@/lib/labels";

function byPlanRecency(a: FuturePlan, b: FuturePlan) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const STATUSES: PlanStatus[] = ["Idea", "Considering", "Planned"];

const STATUS_STYLES: Record<PlanStatus, string> = {
  Idea: "bg-ivory-dim text-walnut",
  Considering: "bg-bronze/15 text-walnut",
  Planned: "bg-forest/10 text-forest",
};

const EMPTY_FORM = { title: "", category: "", status: "Idea" as PlanStatus, description: "" };

export default function FuturePlansPage() {
  const [plans, setPlans] = useState<FuturePlan[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<PlanStatus | "All">("All");

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadPlans = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("future_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setPlans(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadPlans();
  }, [supabase, loadPlans]);

  async function addPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("future_plans")
      .insert({
        title: form.title.trim(),
        category: form.category.trim() || null,
        status: form.status,
        description: form.description.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setPlans((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function updateStatus(id: string, status: PlanStatus) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    if (!supabase) return;
    const { error } = await supabase.from("future_plans").update({ status }).eq("id", id);
    if (error) setError(error.message);
  }

  function deletePlan(id: string) {
    if (!supabase) return;
    const removed = plans.find((p) => p.id === id);
    if (!removed) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    scheduleUndo(
      `"${removed.title}" törölve.`,
      async () => {
        const { error } = await supabase.from("future_plans").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setPlans((prev) => [...prev, removed].sort(byPlanRecency))
    );
  }

  const visiblePlans = filter === "All" ? plans : plans.filter((p) => p.status === filter);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Jövőbeli tervek" />
        <EmptyState icon={Lightbulb} title="Csatlakoztasd a Supabase-t az ötletek rögzítéséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Jövőbeli tervek"
        subtitle="Ötletgyűjtő arra, mi jöhet az indulás után."
        action={
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Ötlet hozzáadása
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={addPlan} className="card mb-6 flex flex-col gap-3 p-5 animate-fade-in">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="pl. Céges ajándékcsomagok"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="pl. Termék, Csatorna"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`badge cursor-pointer border ${
                    form.status === s
                      ? "border-bronze bg-bronze text-white"
                      : "border-border bg-white text-muted"
                  }`}
                >
                  {PLAN_STATUS_HU[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
            <textarea
              className="textarea min-h-20"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Mi az ötlet, és miért lehet fontos?"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Ötlet mentése"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {!loading && plans.length > 0 && (
        <div className="mb-4 flex gap-2">
          {(["All", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`badge cursor-pointer border ${
                filter === s ? "border-forest bg-forest text-ivory" : "border-border bg-white text-muted"
              }`}
            >
              {s === "All" ? "Összes" : PLAN_STATUS_HU[s]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Még nincs rögzített ötlet"
          description="Gyűjts össze mindent, amit érdemes lehet újragondolni az indulás után — új termékek, csatornák, partnerségek."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePlans.map((plan) => (
            <div key={plan.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-forest">{plan.title}</p>
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="shrink-0 text-muted hover:text-red-600"
                  aria-label="Ötlet törlése"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {plan.category && <span className="badge w-fit bg-ivory-dim text-walnut">{plan.category}</span>}
              {plan.description && <p className="text-sm text-muted">{plan.description}</p>}
              <select
                className={`select mt-1 w-fit text-xs ${STATUS_STYLES[plan.status]}`}
                value={plan.status}
                onChange={(e) => updateStatus(plan.id, e.target.value as PlanStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PLAN_STATUS_HU[s]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}
