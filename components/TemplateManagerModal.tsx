"use client";

import { useState } from "react";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { TaskPriority, TaskTemplate } from "@/lib/supabase/types";
import { PRIORITY_HU, TEMPLATE_CATEGORY_ORDER, TEMPLATE_ASSIGNEE_OPTIONS, groupByCategory } from "@/lib/labels";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";

const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];
const NEW_CATEGORY = "__new__";

const EMPTY_FORM = {
  title: "",
  category: "",
  newCategory: "",
  default_priority: "Medium" as TaskPriority,
  default_assignee: "",
  notes_template: "",
};

function byRecency(a: TaskTemplate, b: TaskTemplate) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** CRUD editor for task_templates — lists everything grouped by category
 * with edit/delete per row, plus a create form. Every change goes through
 * `onChange` so the picker modal (which holds its own copy of the list)
 * stays in sync without a refetch. */
export default function TemplateManagerModal({
  templates,
  onClose,
  onChange,
}: {
  templates: TaskTemplate[];
  onClose: () => void;
  onChange: (next: TaskTemplate[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const existingCategories = groupByCategory(templates, TEMPLATE_CATEGORY_ORDER).map((g) => g.category);
  const groups = groupByCategory(templates, TEMPLATE_CATEGORY_ORDER);

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(t: TaskTemplate) {
    setShowForm(false);
    setEditingId(t.id);
    setForm({
      title: t.title,
      category: t.category,
      newCategory: "",
      default_priority: t.default_priority,
      default_assignee: t.default_assignee ?? "",
      notes_template: t.notes_template ?? "",
    });
  }

  function resolvedCategory() {
    return form.category === NEW_CATEGORY ? form.newCategory.trim() : form.category.trim();
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const category = resolvedCategory();
    if (!supabase || !form.title.trim() || !category) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("task_templates")
      .insert({
        title: form.title.trim(),
        category,
        default_priority: form.default_priority,
        default_assignee: form.default_assignee || null,
        notes_template: form.notes_template.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) onChange([data, ...templates]);
    resetForm();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const category = resolvedCategory();
    if (!supabase || !editingId || !form.title.trim() || !category) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("task_templates")
      .update({
        title: form.title.trim(),
        category,
        default_priority: form.default_priority,
        default_assignee: form.default_assignee || null,
        notes_template: form.notes_template.trim() || null,
      })
      .eq("id", editingId)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) onChange(templates.map((t) => (t.id === editingId ? data : t)));
    resetForm();
  }

  function deleteTemplate(t: TaskTemplate) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (editingId === t.id) resetForm();
    onChange(templates.filter((x) => x.id !== t.id));
    scheduleUndo(
      `"${t.title}" sablon törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("task_templates").delete().eq("id", t.id);
        if (deleteError) setError(deleteError.message);
      },
      () => onChange([...templates.filter((x) => x.id !== t.id), t].sort(byRecency))
    );
  }

  const formFields = (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="pl. Új árajánlat bekérése"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kategória *</label>
          <select
            className="select"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="" disabled>
              Válassz…
            </option>
            {existingCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ Új kategória</option>
          </select>
          {form.category === NEW_CATEGORY && (
            <input
              className="input mt-2"
              required
              value={form.newCategory}
              onChange={(e) => setForm((f) => ({ ...f, newCategory: e.target.value }))}
              placeholder="Új kategória neve"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Alapértelmezett prioritás</label>
          <select
            className="select"
            value={form.default_priority}
            onChange={(e) => setForm((f) => ({ ...f, default_priority: e.target.value as TaskPriority }))}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_HU[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Alapértelmezett felelős</label>
          <select
            className="select"
            value={form.default_assignee}
            onChange={(e) => setForm((f) => ({ ...f, default_assignee: e.target.value }))}
          >
            <option value="">— Nincs megadva —</option>
            {TEMPLATE_ASSIGNEE_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés-sablon</label>
        <textarea
          className="textarea min-h-16"
          value={form.notes_template}
          onChange={(e) => setForm((f) => ({ ...f, notes_template: e.target.value }))}
          placeholder="Előre kitöltött megjegyzés-szöveg (opcionális)…"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : editingId ? "Mentés" : "Sablon létrehozása"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetForm}>
          Mégse
        </button>
      </div>
    </>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <div
          className="animate-fade-in card flex max-h-full w-full max-w-xl flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border p-5">
            <h2 className="font-serif text-xl text-forest">Sablonok kezelése</h2>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
              aria-label="Bezárás"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {editingId && (
              <form onSubmit={saveEdit} className="card mb-5 flex flex-col gap-3 p-4">
                <p className="text-xs font-medium text-bronze">Sablon szerkesztése</p>
                {formFields}
              </form>
            )}

            {!editingId &&
              (showForm ? (
                <form onSubmit={createTemplate} className="card mb-5 flex flex-col gap-3 p-4">
                  {formFields}
                </form>
              ) : (
                <button className="btn btn-bronze mb-5" onClick={() => setShowForm(true)}>
                  <Plus size={16} /> Új sablon létrehozása
                </button>
              ))}

            {templates.length === 0 ? (
              <p className="text-sm text-muted">Még nincs egy sablon sem.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map(({ category, items }) => (
                  <div key={category}>
                    <h3 className="mb-2 font-serif text-sm text-forest">{category}</h3>
                    <div className="flex flex-col gap-1.5">
                      {items.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-ivory-dim"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-forest">{t.title}</p>
                            <p className="text-xs text-muted">
                              {PRIORITY_HU[t.default_priority]}
                              {t.default_assignee && ` · ${t.default_assignee}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => startEdit(t)}
                              className="rounded-md p-1.5 text-muted hover:bg-white hover:text-forest"
                              aria-label="Szerkesztés"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteTemplate(t)}
                              className="rounded-md p-1.5 text-muted hover:bg-white hover:text-red-600"
                              aria-label="Törlés"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}
