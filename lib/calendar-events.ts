// Every event the Naptár page (app/(dashboard)/calendar/page.tsx) and the
// .ics subscription feed (app/api/calendar/ics/route.ts) show — one shared
// query+assembly function so the two can never drift apart on what counts
// as a calendar event.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecurrenceType, Season } from "@/lib/supabase/types";
import { SEASON_HU, type CalendarCategory } from "@/lib/labels";
import { goldCardDueDatesInRange } from "@/lib/gold-card";
import { occurrencesInRange, parseISODate, toISODate } from "@/lib/recurring-templates";

export type CalendarEventItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: CalendarCategory;
  href: string;
};

const SEASON_MONTH: Record<Season, number> = { Spring: 2, Summer: 5, Autumn: 8, Winter: 11 };

/**
 * Synthetic/forecast sources (marketing seasons, Gold Card due dates,
 * recurring template forecasts) are generated across a fixed window
 * anchored on *today* — not whatever month a dashboard visitor happens to
 * be viewing — so both the month grid (however far someone navigates,
 * within reason) and the .ics feed (polled independently by a calendar
 * app, with no "current view" of its own) see the same real dates.
 */
export async function fetchAllCalendarEvents(supabase: SupabaseClient<Database>): Promise<CalendarEventItem[]> {
  const today = new Date();
  const rangeStart = new Date(today.getFullYear() - 1, 0, 1);
  const rangeEnd = new Date(today.getFullYear() + 2, 11, 31);

  const [
    tasksRes,
    suppliersRes,
    documentsRes,
    plansRes,
    ordersRes,
    campaignsRes,
    contentRes,
    goldCardLettersRes,
    journeyMemoriesRes,
    wildCardCompletionsRes,
    templatesRes,
    customEventsRes,
    companySettingsRes,
  ] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date").not("due_date", "is", null),
    supabase.from("suppliers").select("id, name, created_at, contract_valid_until"),
    supabase.from("documents").select("id, title, created_at"),
    supabase.from("future_plans").select("id, title, created_at"),
    supabase.from("orders").select("id, customer_name, delivery_date").not("delivery_date", "is", null),
    supabase.from("marketing_campaigns").select("id, season, theme"),
    supabase.from("marketing_content").select("id, title, content_type, scheduled_date"),
    supabase.from("gold_card_letters").select("id, seq_number, sealed_date"),
    supabase.from("journey_memories").select("id, place, date"),
    supabase.from("wild_card_completions").select("id, wildcard_name, completed_date"),
    supabase
      .from("task_templates")
      .select("id, title, is_recurring, recurrence_type, recurrence_interval, next_due_date"),
    supabase.from("calendar_events").select("id, title, date, time"),
    supabase.from("company_settings").select("gold_card_reminder_enabled").maybeSingle(),
  ]);

  const events: CalendarEventItem[] = [];

  for (const t of tasksRes.data ?? []) {
    events.push({ id: `task-${t.id}`, date: t.due_date as string, title: t.title, category: "task", href: `/tasks?open=${t.id}` });
  }

  for (const s of suppliersRes.data ?? []) {
    events.push({
      id: `supplier-${s.id}`,
      date: s.created_at.slice(0, 10),
      title: `${s.name} — hozzáadva`,
      category: "supplier",
      href: "/suppliers",
    });
    if (s.contract_valid_until) {
      events.push({
        id: `contract-${s.id}`,
        date: s.contract_valid_until,
        title: `${s.name} — szerződés lejár`,
        category: "contract",
        href: "/suppliers",
      });
    }
  }

  for (const d of documentsRes.data ?? []) {
    events.push({ id: `document-${d.id}`, date: d.created_at.slice(0, 10), title: `${d.title} — hozzáadva`, category: "document", href: "/documents" });
  }

  for (const p of plansRes.data ?? []) {
    events.push({ id: `plan-${p.id}`, date: p.created_at.slice(0, 10), title: `${p.title} — hozzáadva`, category: "plan", href: "/future-plans" });
  }

  for (const o of ordersRes.data ?? []) {
    events.push({ id: `order-${o.id}`, date: o.delivery_date as string, title: `${o.customer_name} — szállítás`, category: "order", href: "/orders" });
  }

  for (const c of contentRes.data ?? []) {
    events.push({ id: `content-${c.id}`, date: c.scheduled_date as string, title: `${c.title} (${c.content_type})`, category: "content", href: "/marketing" });
  }

  for (const l of goldCardLettersRes.data ?? []) {
    events.push({
      id: `goldcard-${l.id}`,
      date: l.sealed_date as string,
      title: `Gold Card levél #${l.seq_number} — lepecsételve`,
      category: "ritual",
      href: "/personal-ritual",
    });
  }

  for (const m of journeyMemoriesRes.data ?? []) {
    events.push({ id: `memory-${m.id}`, date: m.date as string, title: `${m.place} — emlék`, category: "ritual", href: "/personal-ritual" });
  }

  for (const w of wildCardCompletionsRes.data ?? []) {
    events.push({
      id: `wildcard-${w.id}`,
      date: w.completed_date as string,
      title: `Wild Card teljesítve: ${w.wildcard_name}`,
      category: "ritual",
      href: "/personal-ritual",
    });
  }

  // Marketing campaigns don't have exact dates, only a season — mapped to
  // that season's start day, for every year in the window.
  const campaigns: { id: string; season: Season; theme: string | null }[] = campaignsRes.data ?? [];
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
    for (const c of campaigns) {
      events.push({
        id: `marketing-${c.id}-${y}`,
        date: toISODate(new Date(y, SEASON_MONTH[c.season], 1)),
        title: `${SEASON_HU[c.season]} kampány${c.theme ? ` — ${c.theme}` : ""}`,
        category: "marketing",
        href: "/marketing",
      });
    }
  }

  // Gold Card Letters' next due date isn't stored anywhere — it's computed
  // from the fixed quarterly schedule (see lib/gold-card.ts). Gated by
  // Beállítások → Naptár-integráció, same as the Áttekintés countdown.
  const goldCardReminderEnabled = companySettingsRes.data?.gold_card_reminder_enabled ?? true;
  if (goldCardReminderEnabled) {
    for (const d of goldCardDueDatesInRange(rangeStart, rangeEnd)) {
      events.push({ id: `goldcard-due-${toISODate(d)}`, date: toISODate(d), title: "Gold Card levél esedékes", category: "ritual", href: "/personal-ritual" });
    }
  }

  // Recurring task templates — every future occurrence within the window,
  // not just the single next_due_date task_templates tracks (that column
  // only ever holds the one date runRecurringTemplateCheck will act on
  // next; occurrencesInRange projects the rest forward for display only).
  for (const t of templatesRes.data ?? []) {
    if (!t.is_recurring || !t.recurrence_type || !t.next_due_date) continue;
    const occurrences = occurrencesInRange(
      parseISODate(t.next_due_date),
      t.recurrence_type as RecurrenceType,
      t.recurrence_interval,
      rangeEnd
    );
    for (const d of occurrences) {
      const iso = toISODate(d);
      events.push({ id: `recurring-${t.id}-${iso}`, date: iso, title: `${t.title} (esedékes)`, category: "recurring", href: "/tasks" });
    }
  }

  // Hand-added, standalone events — see components/CalendarEventModal.tsx.
  for (const e of customEventsRes.data ?? []) {
    events.push({ id: `event-${e.id}`, date: e.date, title: e.time ? `${e.title} (${e.time})` : e.title, category: "event", href: "/calendar" });
  }

  return events;
}
