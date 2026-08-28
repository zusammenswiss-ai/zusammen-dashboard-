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
  Archive,
  ArchiveRestore,
  X,
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
import { runRecurringTemplateCheck } from "@/lib/recurring-templates";

function byTaskRecency(a: TaskItem, b: TaskItem) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function byArchivedRecency(a: TaskItem, b: TaskItem) {
  return new Date(b.archived_at ?? 0).getTime() - new Date(a.archived_at ?? 0).getTime();
}

// due_date is a plain "YYYY-MM-DD" string (a date column, no time/zone),
// so a simple string compare against today's date in the same format is
// correct and avoids any timezone-conversion surprises a Date object
// comparison would introduce.
function isOverdue(task: TaskItem): boolean {
  if (!task.due_date || task.status === "Kész") return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
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
  const [showArchive, setShowArchive] = useState(false);
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
      const loaded = data ?? [];
      setTemplates(loaded);

      // Recurring templates auto-generate their next Teendő task right
      // here, on every Feladatok page load — see lib/recurring-templates.ts
      // for why there's no separate cron for this. Re-running loadTasks()
      // afterwards (rather than splicing createdTasks into state by hand)
      // sidesteps a race against the other, independent load-on-mount
      // effect above: whichever finishes first, this always ends with a
      // fresh SELECT taken after the insert has landed.
      const { createdTasks, updatedTemplates } = await runRecurringTemplateCheck(supabase, loaded);
      if (createdTasks.length > 0) void loadTasks();
      if (updatedTemplates.length > 0) {
        setTemplates((prev) =>
          prev.map((t) => updatedTemplates.find((u) => u.id === t.id) ?? t)
        );
      }
    })();
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

  // Archived tasks never appear on the Kanban board itself — only in the
  // separate Archívum view — so every board-facing list is derived from
  // activeTasks, not the raw tasks state (which still holds both, since
  // loadTasks fetches everything in one query rather than running two).
  const activeTasks = useMemo(() => tasks.filter((t) => !t.archived_at), [tasks]);
  const archivedTasks = useMemo(
    () => tasks.filter((t) => t.archived_at).sort(byArchivedRecency),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeTasks;
    return activeTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.assignee ?? "").toLowerCase().includes(q)
    );
  }, [activeTasks, query]);

  function archiveTask(id: string) {
    void updateTask(id, { archived_at: new Date().toISOString() });
  }

  function restoreTask(id: string) {
    void updateTask(id, { archived_at: null });
  }

  async function bulkArchive(ids: string[]) {
    if (ids.length === 0 || !supabase) return;
    const now = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, archived_at: now } : t)));
    const { error } = await supabase.from("tasks").update({ archived_at: now }).in("id", ids);
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
            <button className="btn btn-ghost" onClick={() => setShowArchive(true)}>
              <Archive size={16} /> Archívum
              {archivedTasks.length > 0 && ` (${archivedTasks.length})`}
            </button>
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
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-base text-forest">{status}</h2>
                    <span className="badge bg-ivory-dim text-walnut">{columnTasks.length}</span>
                  </div>
                  {status === "Kész" && columnTasks.length > 0 && (
                    <button
                      onClick={() => bulkArchive(columnTasks.map((t) => t.id))}
                      className="flex items-center gap-1 text-xs text-muted hover:text-forest"
                      title="Az összes látható Kész feladat archiválása"
                    >
                      <Archive size={12} /> Összes archiválása
                    </button>
                  )}
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
                    onArchive={status === "Kész" ? () => archiveTask(task.id) : undefined}
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

      {showArchive && (
        <ArchiveModal
          tasks={archivedTasks}
          onClose={() => setShowArchive(false)}
          onRestore={restoreTask}
          onDelete={deleteTask}
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
  onArchive,
  onStatusChange,
}: {
  task: TaskItem;
  onDragStart: (id: string) => void;
  onOpen: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const overdue = isOverdue(task);
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={onOpen}
      className={`card group cursor-grab p-3 text-left active:cursor-grabbing ${
        overdue ? "border-red-300 ring-1 ring-red-200" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-forest">{task.title}</p>
        {/* Always visible (not hover-gated) — a hover-only reveal is
            unreachable on touch devices like iPad. */}
        <div className="flex shrink-0 items-center gap-0.5">
          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="p-0.5 text-muted/70 hover:text-forest"
              aria-label="Archiválás"
              title="Archiválás"
            >
              <Archive size={13} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-0.5 text-muted/70 hover:text-red-600"
            aria-label="Törlés"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{PRIORITY_HU[task.priority]}</span>
        {task.category && <span className="badge bg-ivory-dim text-walnut">{task.category}</span>}
        {overdue && <span className="badge bg-red-100 text-red-700">Lejárt</span>}
      </div>

      {(task.due_date || task.assignee || task.notes) && (
        <div className="mt-2.5 flex items-center gap-3 text-xs text-muted">
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? "font-medium text-red-600" : ""}`}>
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

/** Where archived ("Kész" tasks taken off the board) tasks live — never
 * shown on the Kanban board itself, only reachable from here. Every row
 * offers "Visszaállítás" (undo, effectively — puts it straight back into
 * Kész) or a real, final Törlés, which reuses the page's normal
 * delete-with-undo-toast flow, so nothing here bypasses that safety net. */
function ArchiveModal({
  tasks,
  onClose,
  onRestore,
  onDelete,
}: {
  tasks: TaskItem[];
  onClose: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-serif text-lg text-forest">Archívum</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted">Még nincs archivált feladat.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-forest">{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>
                        {PRIORITY_HU[task.priority]}
                      </span>
                      {task.category && <span className="badge bg-ivory-dim text-walnut">{task.category}</span>}
                    </div>
                    {task.archived_at && (
                      <p className="mt-1.5 text-xs text-muted">Archiválva: {formatDate(task.archived_at)}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onRestore(task.id)}
                      className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
                      aria-label="Visszaállítás"
                      title="Visszaállítás a Kész oszlopba"
                    >
                      <ArchiveRestore size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-red-600"
                      aria-label="Végleges törlés"
                      title="Végleges törlés"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
