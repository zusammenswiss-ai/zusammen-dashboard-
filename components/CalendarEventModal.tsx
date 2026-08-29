"use client";

import { useEffect, useState } from "react";
import { X, CalendarPlus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/supabase/types";
import { ErrorBanner } from "@/components/Feedback";

/** Create/edit modal for a hand-added Naptár event (calendar_events) —
 * the one event source on the Naptár page that isn't aggregated from
 * some other table. `event` set = edit mode; omitted = create mode. */
export default function CalendarEventModal({
  event,
  defaultDate,
  onClose,
  onSaved,
}: {
  event?: CalendarEvent;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate ?? "");
  const [time, setTime] = useState(event?.time ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim() || !date) return;
    setSaving(true);
    setError(null);
    const payload = { title: title.trim(), date, time: time.trim() || null, notes: notes.trim() || null };
    const { data, error: saveError } = event
      ? await supabase.from("calendar_events").update(payload).eq("id", event.id).select().single()
      : await supabase.from("calendar_events").insert(payload).select().single();
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (data) onSaved(data);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-md flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg text-forest">
            <CalendarPlus size={17} /> {event ? "Esemény szerkesztése" : "Új esemény"}
          </h2>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={save} className="flex flex-col gap-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
            <input
              className="input"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="pl. Ügyfél megbeszélés"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Dátum *</label>
              <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Időpont</label>
              <input className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="pl. 14:00" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Jegyzet</label>
            <textarea
              className="textarea min-h-16"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcionális…"
            />
          </div>
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Mentés"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Mégse
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
