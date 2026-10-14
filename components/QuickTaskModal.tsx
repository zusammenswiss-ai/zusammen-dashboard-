"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { TaskItem, TaskInsert } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/errors";

/**
 * Minimal "cím + határidő" feladat-felvétel, modalban — ugyanaz a gyors
 * mintázat, amit a DailyActionsCard "Mit csinálunk ma?" sávja bevezetett az
 * Áttekintésen. Kiemelve ide, hogy más oldalak (pl. Marketing) is tudják
 * használni, `extraFields`-del a kontextusnak megfelelő előre kitöltött
 * mezőkkel (category, campaign_label stb.), anélkül hogy a teljes Feladatok
 * oldal formját kéne megnyitni egy gyors bejegyzéshez.
 */
export default function QuickTaskModal({
  heading = "Új feladat",
  defaultTitle = "",
  titlePlaceholder = "pl. Hívd fel a nyomdát",
  extraFields,
  onClose,
  onCreated,
}: {
  heading?: string;
  defaultTitle?: string;
  titlePlaceholder?: string;
  /** Csendben belekerül az insertbe — pl. { category: "Marketing" }. */
  extraFields?: Partial<TaskInsert>;
  onClose: () => void;
  onCreated: (task: TaskItem) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({ ...extraFields, title: title.trim(), due_date: dueDate || null })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült létrehozni a feladatot."));
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form onSubmit={submit} className="animate-fade-in card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-lg text-forest">{heading}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
            <input
              className="input"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Határidő</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Prioritás, kategória és a többi mező a{" "}
          <Link href="/tasks" className="text-forest underline">
            Feladatok
          </Link>{" "}
          oldalon állítható.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Mentés…" : "Létrehozás"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
