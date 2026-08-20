"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  KanbanSquare,
  CalendarDays,
  User,
  StickyNote,
  Search,
  Download,
  LayoutTemplate,
  Settings,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { TaskItem, TaskPriority, TaskStatus, TaskTemplate } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import TaskDetailModal from "@/components/TaskDetailModal";
import TemplatePickerModal from "@/components/TemplatePickerModal";
import TemplateManagerModal from "@/components/TemplateManagerModal";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatDate } from "@/lib/format";
import { PRIORITY_HU } from "@/lib/labels";
import { toCSV, downloadCSV } from "@/lib/csv";

function byTaskRecency(a: TaskItem, b: TaskItem) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const EXPORT_HEADERS = ["title", "category", "priority", "status", "due_date", "assignee", "notes"];

function exportTasksCSV(tasks: TaskItem[]) {
  const rows = tasks.map((t) => [
    t.title,
    t.category,
    PRIORITY_HU[t.priority],
    t.status,
    t.due_date,
    t.assignee,
    t.notes,
  ]);
  downloadCSV("feladatok.csv", toCSV(EXPORT_HEADERS, rows));
}

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const draggedId = useRef<string | null>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  // Deep link support: /tasks?open=<id>, used by the Overview activity
  // feed so a task can be opened straight from the main page. Read via
  // window.location instead of useSearchParams to avoid needing a
  // Suspense boundary just for this one-time check.
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get("open");
    if (openId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenTaskId(openId);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from("task_templates")
        .select("*")
        .order("category")
        .order("title");
      setTemplates(data ?? []);
    })();
  }, [supabase]);

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

  function deleteTask(id: string) {
    if (!supabase) return;
    const removed = tasks.find((t) => t.id === id);
    if (!removed) return;
    setOpenTaskId((current) => (current === id ? null : current));
    setTasks((prev) => prev.filter((t) => t.id !== id));
    scheduleUndo(
      `"${removed.title}" törölve.`,
      async () => {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setTasks((prev) => [...prev, removed].sort(byTaskRecency))
    );
  }

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.assignee ?? "").toLowerCase().includes(q)
    );
  }, [tasks, query]);

  function handleDrop(status: TaskStatus) {
    setDragOverCol(null);
    const id = draggedId.current;
    if (id) void updateTask(id, { status });
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Feladatok" backHref="/" />
        <EmptyState icon={KanbanSquare} title="Csatlakoztasd a Supabase-t a feladatok kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Feladatok"
        subtitle="Kanban tábla mindenhez, ami az indulás felé vezet."
        backHref="/"
        action={
          <div className="flex flex-wrap gap-2">
            {tasks.length > 0 && (
              <button className="btn btn-ghost" onClick={() => exportTasksCSV(tasks)}>
                <Download size={16} /> Exportálás CSV-be
              </button>
            )}
            <button
              onClick={() => setShowTemplateManager(true)}
              className="btn btn-ghost !px-2"
              aria-label="Sablonok kezelése"
              title="Sablonok kezelése"
            >
              <Settings size={16} />
            </button>
            <button className="btn btn-ghost" onClick={() => setShowTemplatePicker(true)}>
              <LayoutTemplate size={16} /> Sablonból hozzáadás
            </button>
            <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
              <Plus size={16} /> Feladat hozzáadása
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {!loading && tasks.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Feladatok keresése…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

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
      ) : filteredTasks.length === 0 ? (
        <EmptyState icon={Search} title="Nincs találat" description="Próbálj más keresőszót." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((status) => {
            const columnTasks = filteredTasks.filter((t) => t.status === status);
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
                    onOpen={() => setOpenTaskId(task.id)}
                    onDelete={() => deleteTask(task.id)}
                    onStatusChange={(status) => updateTask(task.id, { status })}
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

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onSave={(patch) => updateTask(openTask.id, patch)}
          onDelete={() => deleteTask(openTask.id)}
        />
      )}

      {showTemplatePicker && (
        <TemplatePickerModal
          templates={templates}
          onClose={() => setShowTemplatePicker(false)}
          onAdded={(newTasks) => setTasks((prev) => [...newTasks, ...prev])}
        />
      )}

      {showTemplateManager && (
        <TemplateManagerModal
          templates={templates}
          onClose={() => setShowTemplateManager(false)}
          onChange={setTemplates}
        />
      )}
    </>
  );
}

function TaskCard({
  task,
  onDragStart,
  onOpen,
  onDelete,
  onStatusChange,
}: {
  task: TaskItem;
  onDragStart: (id: string) => void;
  onOpen: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={onOpen}
      className="card group cursor-grab p-3 text-left active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-forest">{task.title}</p>
        {/* Always visible (not hover-gated) — a hover-only reveal is
            unreachable on touch devices like iPad. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 p-0.5 text-muted/70 hover:text-red-600"
          aria-label="Törlés"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{PRIORITY_HU[task.priority]}</span>
        {task.category && <span className="badge bg-ivory-dim text-walnut">{task.category}</span>}
      </div>

      {(task.due_date || task.assignee || task.notes) && (
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
          {task.notes && (
            <span className="flex items-center gap-1" title="Van megjegyzés">
              <StickyNote size={12} />
            </span>
          )}
        </div>
      )}

      {/* Touch-friendly alternative to drag-and-drop, which the Kanban
          board otherwise relies on — native HTML5 drag doesn't work with
          touch input on iPad/iOS Safari, so this select is the only way
          to move a card between columns there. */}
      <select
        className="select mt-2.5 w-full !py-1 text-xs"
        value={task.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
        aria-label="Állapot módosítása"
      >
        {COLUMNS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}
