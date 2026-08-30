// Recurring task templates — a task_templates row with is_recurring=true
// auto-generates a fresh "Teendő" task on its own schedule instead of
// only ever being picked by hand from the Sablonból hozzáadás picker.
//
// Deliberately no cron/background job: runRecurringTemplateCheck runs
// from app/(dashboard)/tasks/page.tsx every time the Feladatok tab is
// opened, exactly as specced — a founder-facing dashboard visited daily
// doesn't need scheduled infrastructure for something this low-stakes,
// and it keeps the feature self-contained (no Vercel Cron entry, no
// extra env var, nothing to go stale if the page is never opened).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecurrenceType, TaskItem, TaskTemplate } from "@/lib/supabase/types";
import { startOfDay } from "@/lib/gold-card";

// Exported — also used by lib/calendar-events.ts (which needs the same
// ISO-string<->Date conversions and stepping logic to forecast a
// recurring template's future occurrences for the Naptár/ics feed).
export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addRecurrence(date: Date, type: RecurrenceType, step: number): Date {
  switch (type) {
    case "Napi":
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + step);
    case "Heti":
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + step * 7);
    case "Havi":
      return new Date(date.getFullYear(), date.getMonth() + step, date.getDate());
    case "Negyedéves":
      return new Date(date.getFullYear(), date.getMonth() + step * 3, date.getDate());
    case "Éves":
      return new Date(date.getFullYear() + step, date.getMonth(), date.getDate());
  }
}

/**
 * Steps `dueDate` forward by whole recurrence intervals until it's after
 * `today` — same loop shape as lib/gold-card.ts's nextGoldCardDate, so a
 * template nobody's checked on in months jumps straight to its true next
 * occurrence in one go instead of drifting forward one page-load at a
 * time (and, just as importantly, without creating a task for every
 * missed occurrence in between — see runRecurringTemplateCheck).
 */
export function nextOccurrenceAfter(dueDate: Date, type: RecurrenceType, interval: number, today: Date): Date {
  const step = Math.max(1, interval);
  let next = startOfDay(dueDate);
  const t = startOfDay(today);
  while (next.getTime() <= t.getTime()) {
    next = addRecurrence(next, type, step);
  }
  return next;
}

/**
 * Every occurrence of a recurring template from `start` up to and
 * including `rangeEnd` — used to forecast a recurring template on the
 * Naptár/ics feed before it's actually fired into a real task (unlike
 * next_due_date, which only ever tracks the single next occurrence).
 * Capped at 3000 iterations — comfortably covers even a daily
 * recurrence across a multi-year window, and guards against an
 * unexpected infinite loop rather than actually relying on the cap.
 */
export function occurrencesInRange(start: Date, type: RecurrenceType, interval: number, rangeEnd: Date): Date[] {
  const step = Math.max(1, interval);
  const end = startOfDay(rangeEnd);
  const out: Date[] = [];
  let d = startOfDay(start);
  let guard = 0;
  while (d.getTime() <= end.getTime() && guard < 3000) {
    out.push(d);
    d = addRecurrence(d, type, step);
    guard++;
  }
  return out;
}

export type RecurringRunResult = {
  createdTasks: TaskItem[];
  updatedTemplates: TaskTemplate[];
};

/**
 * For every is_recurring template whose next_due_date has arrived or
 * passed: creates exactly one Teendő task from the template's fields
 * (due today), then advances next_due_date to the template's true next
 * future occurrence. At most one new task per template per call, even
 * if several cycles were missed — this mirrors the Gold Card countdown
 * always showing the true next date rather than backfilling every
 * skipped quarter as its own letter.
 *
 * Fails closed: if the task insert errors, nothing is advanced either,
 * so the same templates are simply retried next time Feladatok opens —
 * no risk of silently losing a cycle.
 */
export async function runRecurringTemplateCheck(
  supabase: SupabaseClient<Database>,
  templates: TaskTemplate[]
): Promise<RecurringRunResult> {
  const today = new Date();
  const todayISO = toISODate(today);
  const due = templates.filter(
    (t) => t.is_recurring && t.recurrence_type && t.next_due_date && t.next_due_date <= todayISO
  );
  if (due.length === 0) return { createdTasks: [], updatedTemplates: [] };

  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert(
      due.map((t) => ({
        title: t.title,
        category: t.category,
        priority: t.default_priority,
        status: "Teendő" as const,
        assignee: t.default_assignee,
        notes: t.notes_template,
        due_date: todayISO,
        // Every task this engine fires is by definition Ismétlődő —
        // see the Típus dimension on tasks (supabase/schema.sql).
        task_type: "Ismétlődő" as const,
      }))
    )
    .select();
  if (insertError || !inserted) return { createdTasks: [], updatedTemplates: [] };

  const updates = await Promise.all(
    due.map(async (t) => {
      const nextDate = nextOccurrenceAfter(
        parseISODate(t.next_due_date as string),
        t.recurrence_type as RecurrenceType,
        t.recurrence_interval,
        today
      );
      const { data } = await supabase
        .from("task_templates")
        .update({ next_due_date: toISODate(nextDate) })
        .eq("id", t.id)
        .select()
        .single();
      return data;
    })
  );

  return {
    createdTasks: inserted,
    updatedTemplates: updates.filter((t): t is TaskTemplate => t !== null),
  };
}
