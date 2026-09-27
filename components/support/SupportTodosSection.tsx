"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ListTodo, Pencil, Check, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { SupportTodo } from "@/lib/supabase/types";
import { formatDate } from "@/lib/format";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { errorMessage } from "@/lib/errors";

function byDone(a: SupportTodo, b: SupportTodo) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return b.created_at.localeCompare(a.created_at);
}

/**
 * Saját feladatok — az Ügyfélszolgálat modul belső, kifejezetten
 * ügyfélszolgálati teendőkre szánt listája (pl. "sablonválasz megírása
 * szállítási kérdésekre"). Szándékosan NEM a Feladatok/Kanban modul: nincs
 * állapotgép, csak egy egyszerű kész/nincs kész checkbox — lásd
 * supabase/schema.sql support_todos kommentjét.
 */
export default function SupportTodosSection() {
  const supabase = getSupabaseClient();
  const [todos, setTodos] = useState<SupportTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("support_todos").select("*");
    if (loadError) setError(errorMessage(loadError, "Nem sikerült betölteni a teendőket."));
    setTodos(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function toggleDone(todo: SupportTodo) {
    if (!supabase) return;
    const nextDone = !todo.done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: nextDone } : t)));
    const { error: updateError } = await supabase.from("support_todos").update({ done: nextDone }).eq("id", todo.id);
    if (updateError) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: todo.done } : t)));
      setError(errorMessage(updateError, "Nem sikerült menteni a változást."));
    }
  }

  function handleDelete(todo: SupportTodo) {
    if (!supabase) return;
    if (editingId === todo.id) setEditingId(null);
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    scheduleUndo(
      `"${todo.title}" törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("support_todos").delete().eq("id", todo.id);
        if (deleteError) console.error(deleteError.message);
      },
      () => setTodos((prev) => [...prev, todo])
    );
  }

  if (loading) return <Spinner />;

  const sorted = [...todos].sort(byDone);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Kifejezetten ügyfélszolgálati teendők (pl. sablonválasz írása, GYIK bővítése) — nem a Dashboard fő
          Feladatok/Kanban modulja.
        </p>
        <button
          type="button"
          className="btn btn-bronze !px-3 !py-1.5 text-xs shrink-0"
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus size={14} /> Új teendő
        </button>
      </div>

      {showForm && (
        <TodoForm
          onSaved={(t) => {
            setTodos((prev) => [...prev, t]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={ListTodo} title="Még nincs rögzített teendő" description="Add hozzá az ügyfélszolgálathoz kapcsolódó apró feladatokat." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((t) =>
            editingId === t.id ? (
              <TodoEditRow
                key={t.id}
                todo={t}
                onSaved={(saved) => {
                  setTodos((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={t.id}
                className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm hover:border-bronze/40"
              >
                <button
                  type="button"
                  onClick={() => void toggleDone(t)}
                  aria-label={t.done ? "Visszajelölés nincs késznek" : "Megjelölés késznek"}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    t.done ? "border-forest bg-forest text-white" : "border-border"
                  }`}
                >
                  {t.done && <Check size={13} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${t.done ? "text-muted line-through" : "text-forest"}`}>{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                  {t.due_date && <p className="mt-0.5 text-xs text-muted">Határidő: {formatDate(t.due_date)}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => setEditingId(t.id)} className="text-muted/70 hover:text-forest" title="Szerkesztés">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(t)} className="text-muted/70 hover:text-red-600" title="Törlés">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function TodoForm({ onSaved, onCancel }: { onSaved: (t: SupportTodo) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim()) {
      setError("Adj meg egy címet.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("support_todos")
      .insert({ title: title.trim(), description: description.trim() || null, due_date: dueDate || null })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a teendőt."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={submit} className="flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
        <input
          className="input"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="pl. Sablonválasz megírása szállítási kérdésekre"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
        <textarea className="textarea min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="w-fit">
        <label className="mb-1 block text-xs font-medium text-muted">Határidő</label>
        <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Teendő mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function TodoEditRow({
  todo,
  onSaved,
  onCancel,
}: {
  todo: SupportTodo;
  onSaved: (t: SupportTodo) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [dueDate, setDueDate] = useState(todo.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim()) {
      setError("Adj meg egy címet.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("support_todos")
      .update({ title: title.trim(), description: description.trim() || null, due_date: dueDate || null })
      .eq("id", todo.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a teendőt."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
        <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
        <textarea className="textarea min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="w-fit">
        <label className="mb-1 block text-xs font-medium text-muted">Határidő</label>
        <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Mégse
        </button>
      </div>
    </form>
  );
}
