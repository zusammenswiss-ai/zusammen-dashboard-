"use client";

import { useEffect, useState } from "react";
import { X, Trash2, CalendarDays, User, Tag } from "lucide-react";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/supabase/types";
import { PRIORITY_HU } from "@/lib/labels";

const STATUSES: TaskStatus[] = ["Teendő", "Folyamatban", "Kész"];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

/** Full detail/edit view for a single task — opened from a Kanban card or
 * deep-linked from the Overview activity feed via /tasks?open=<id>. */
export default function TaskDetailModal({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: TaskItem;
  onClose: () => void;
  onSave: (patch: Partial<TaskItem>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    title: task.title,
    category: task.category ?? "",
    priority: task.priority,
    status: task.status,
    due_date: task.due_date ?? "",
    assignee: task.assignee ?? "",
    notes: task.notes ?? "",
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function save() {
    onSave({
      title: draft.title.trim() || task.title,
      category: draft.category.trim() || null,
      priority: draft.priority,
      status: draft.status,
      due_date: draft.due_date || null,
      assignee: draft.assignee.trim() || null,
      notes: draft.notes.trim() || null,
    });
    onClose();
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
          <input
            className="w-full border-none bg-transparent font-serif text-xl text-forest outline-none"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            aria-label="Feladat címe"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                <Tag size={12} /> Kategória
              </label>
              <input
                className="input"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="pl. Gyártás"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
              <select
                className="select"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TaskStatus }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Prioritás</label>
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
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                <CalendarDays size={12} /> Határidő
              </label>
              <input
                type="date"
                className="input"
                value={draft.due_date}
                onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                <User size={12} /> Felelős
              </label>
              <input
                className="input"
                value={draft.assignee}
                onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                placeholder="Ki felelős ezért?"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
            <textarea
              className="textarea min-h-32"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Részletek, kontextus, linkek, kikkel kell egyeztetni…"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <button onClick={onDelete} className="btn btn-danger" aria-label="Feladat törlése">
            <Trash2 size={15} /> Törlés
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Mégse
            </button>
            <button onClick={save} className="btn btn-primary">
              Mentés
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
