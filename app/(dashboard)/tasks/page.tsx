"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, KanbanSquare, CalendarDays, User, X, Check } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { PRIORITY_HU } from "@/lib/labels";

const COLUMNS: TaskStatus[] = ["Teendő", "Folyamatban", "Kész"];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Low: "bg-forest/10 text-forest",
  Medium: "bg-bronze/15 text-walnut",
  High: "bg-red-100 text-red-700",
};

const EMPTY_FORM = {
  title: "",
  category: "",
  priority: "Medium" as TaskPriority,
  due_date: "",
  assignee: "",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const draggedId = useRef<string | null>(null);

  const supabase = getSupabaseClient();

  const loadTasks = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setTasks(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadTasks();
  }, [supabase, loadTasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        category: form.category.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        assignee: form.assignee.trim() || null,
        status: "Teendő",
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setTasks((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function updateTask(id: string, patch: Partial<TaskItem>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  async function deleteTask(id: string) {
    if (!supabase) return;
    if (!confirm("Törlöd ezt a feladatot?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) setError(error.message);
  }

  function handleDrop(status: TaskStatus) {
    setDragOverCol(null);
    const id = draggedId.current;
    if (id) void updateTask(id, { status });
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Feladatok" />
        <EmptyState icon={KanbanSquare} title="Csatlakoztasd a Supabase-t a feladatok kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Feladatok"
        subtitle="Kanban tábla mindenhez, ami az indulás felé vezet."
        action={
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Feladat hozzáadása
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form
          onSubmit={addTask}
          className="card mb-6 grid animate-fade-in grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        >
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
            <input
              className="input"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="pl. Dobozgyártó ajánlatának véglegesítése"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="pl. Gyártás"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Prioritás</label>
            <select
              className="select"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_HU[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Határidő</label>
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Felelős</label>
              <input
                className="input"
                value={form.assignee}
                onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                placeholder="Ki"
              />
            </div>
          </div>
          <div className="flex gap-2 lg:col-span-5">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Feladat hozzáadása"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="Még nincs feladat"
          description="Add hozzá az első indulási feladatot — a Teendő oszlopban jelenik meg."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(status);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(status);
                }}
                className={`flex min-h-[16rem] flex-col gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
                  dragOverCol === status ? "border-bronze bg-bronze/5" : "border-transparent"
                }`}
              >
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-serif text-base text-forest">{status}</h2>
                  <span className="badge bg-ivory-dim text-walnut">{columnTasks.length}</span>
                </div>
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDragStart={(id) => {
                      draggedId.current = id;
                    }}
                    onUpdate={(patch) => updateTask(task.id, patch)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
                {columnTasks.length === 0 && (
                  <p className="px-1 text-xs text-muted">Húzd ide a feladatokat</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function TaskCard({
  task,
  onDragStart,
  onUpdate,
  onDelete,
}: {
  task: TaskItem;
  onDragStart: (id: string) => void;
  onUpdate: (patch: Partial<TaskItem>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    category: task.category ?? "",
    priority: task.priority,
    due_date: task.due_date ?? "",
    assignee: task.assignee ?? "",
  });

  function save() {
    onUpdate({
      title: draft.title.trim() || task.title,
      category: draft.category.trim() || null,
      priority: draft.priority,
      due_date: draft.due_date || null,
      assignee: draft.assignee.trim() || null,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="card flex flex-col gap-2 p-3">
        <input
          className="input"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Kategória"
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
        />
        <select
          className="select"
          value={draft.priority}
          onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_HU[p]}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          value={draft.due_date}
          onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Felelős"
          value={draft.assignee}
          onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
        />
        <div className="flex gap-2">
          <button onClick={save} className="btn btn-primary flex-1 !py-1.5">
            <Check size={14} /> Mentés
          </button>
          <button onClick={() => setEditing(false)} className="btn btn-ghost !py-1.5">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="card group cursor-grab p-3 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-forest">{task.title}</p>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => setEditing(true)} className="text-muted hover:text-bronze" aria-label="Szerkesztés">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="text-muted hover:text-red-600" aria-label="Törlés">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{PRIORITY_HU[task.priority]}</span>
        {task.category && <span className="badge bg-ivory-dim text-walnut">{task.category}</span>}
      </div>

      {(task.due_date || task.assignee) && (
        <div className="mt-2.5 flex items-center gap-3 text-xs text-muted">
          {task.due_date && (
            <span className="flex items-center gap-1">
              <CalendarDays size={12} /> {formatDate(task.due_date)}
            </span>
          )}
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User size={12} /> {task.assignee}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
