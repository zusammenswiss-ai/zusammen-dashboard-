"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Season } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { CALENDAR_CATEGORIES, SEASON_HU, type CalendarCategory } from "@/lib/labels";

type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: CalendarCategory;
  href: string;
};

// Literal class names (not built via template strings) so Tailwind's
// scanner can see and generate them.
const CATEGORY_DOT: Record<CalendarCategory, string> = {
  task: "bg-bronze",
  supplier: "bg-walnut",
  document: "bg-forest",
  marketing: "bg-slate",
  plan: "bg-mauve",
  order: "bg-forest-light",
};

const WEEKDAY_LABELS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const SEASON_MONTH: Record<Season, number> = { Spring: 2, Summer: 5, Autumn: 8, Winter: 11 };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISODate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function todayISO() {
  const d = new Date();
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function CalendarPage() {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [fixedEvents, setFixedEvents] = useState<CalendarEvent[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; season: Season; theme: string | null }[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksRes, suppliersRes, documentsRes, plansRes, ordersRes, campaignsRes] = await Promise.all([
          supabase.from("tasks").select("id, title, due_date").not("due_date", "is", null),
          supabase.from("suppliers").select("id, name, created_at"),
          supabase.from("documents").select("id, title, created_at"),
          supabase.from("future_plans").select("id, title, created_at"),
          supabase.from("orders").select("id, customer_name, delivery_date").not("delivery_date", "is", null),
          supabase.from("marketing_campaigns").select("id, season, theme"),
        ]);

        const firstError =
          tasksRes.error ||
          suppliersRes.error ||
          documentsRes.error ||
          plansRes.error ||
          ordersRes.error ||
          campaignsRes.error;
        if (firstError) throw firstError;

        const events: CalendarEvent[] = [
          ...(tasksRes.data ?? []).map((t) => ({
            id: `task-${t.id}`,
            date: t.due_date as string,
            title: t.title,
            category: "task" as const,
            href: `/tasks?open=${t.id}`,
          })),
          ...(suppliersRes.data ?? []).map((s) => ({
            id: `supplier-${s.id}`,
            date: s.created_at.slice(0, 10),
            title: `${s.name} — hozzáadva`,
            category: "supplier" as const,
            href: "/suppliers",
          })),
          ...(documentsRes.data ?? []).map((d) => ({
            id: `document-${d.id}`,
            date: d.created_at.slice(0, 10),
            title: `${d.title} — hozzáadva`,
            category: "document" as const,
            href: "/documents",
          })),
          ...(plansRes.data ?? []).map((p) => ({
            id: `plan-${p.id}`,
            date: p.created_at.slice(0, 10),
            title: `${p.title} — hozzáadva`,
            category: "plan" as const,
            href: "/future-plans",
          })),
          ...(ordersRes.data ?? []).map((o) => ({
            id: `order-${o.id}`,
            date: o.delivery_date as string,
            title: `${o.customer_name} — szállítás`,
            category: "order" as const,
            href: "/orders",
          })),
        ];

        setFixedEvents(events);
        setCampaigns(campaignsRes.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nem sikerült betölteni a naptár adatait.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Marketing campaigns don't have exact dates, only a season — mapped to
  // that season's start day, recomputed for the visible year (and its
  // neighbors, so leading/trailing days from Dec/Jan still show correctly).
  const marketingEvents = useMemo(() => {
    const out: CalendarEvent[] = [];
    for (const yearOffset of [-1, 0, 1]) {
      const y = cursor.year + yearOffset;
      for (const c of campaigns) {
        out.push({
          id: `marketing-${c.id}-${y}`,
          date: toISODate(y, SEASON_MONTH[c.season], 1),
          title: `${SEASON_HU[c.season]} kampány${c.theme ? ` — ${c.theme}` : ""}`,
          category: "marketing",
          href: "/marketing",
        });
      }
    }
    return out;
  }, [campaigns, cursor.year]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of [...fixedEvents, ...marketingEvents]) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return map;
  }, [fixedEvents, marketingEvents]);

  const cells = useMemo(() => {
    const { year, month } = cursor;
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
    const total = daysInMonth(year, month);
    const totalCells = Math.ceil((firstWeekday + total) / 7) * 7;
    const out: { date: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1) {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const d = daysInMonth(prevYear, prevMonth) + dayNum;
        out.push({ date: toISODate(prevYear, prevMonth, d), day: d, inMonth: false });
      } else if (dayNum > total) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const d = dayNum - total;
        out.push({ date: toISODate(nextYear, nextMonth, d), day: d, inMonth: false });
      } else {
        out.push({ date: toISODate(year, month, dayNum), day: dayNum, inMonth: true });
      }
    }
    return out;
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat("hu-HU", { month: "long", year: "numeric" }).format(
    new Date(cursor.year, cursor.month, 1)
  );

  function shiftMonth(delta: number) {
    setSelectedDate(null);
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayISO());
  }

  const today = todayISO();
  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Naptár" />
        <EmptyState icon={CalendarRange} title="Csatlakoztasd a Supabase-t a naptár használatához" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Naptár"
        subtitle="Minden határidő és esemény egy helyen, kategóriánként színezve."
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {(Object.keys(CALENDAR_CATEGORIES) as CalendarCategory[]).map((key) => (
              <span key={key} className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[key]}`} />
                {CALENDAR_CATEGORIES[key].label}
              </span>
            ))}
          </div>

          <div className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg capitalize text-forest">{monthLabel}</h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="btn btn-ghost !px-2"
                  aria-label="Előző hónap"
                >
                  <ChevronLeft size={16} />
                </button>
                <button onClick={goToday} className="btn btn-ghost !px-3 text-xs">
                  Ma
                </button>
                <button
                  onClick={() => shiftMonth(1)}
                  className="btn btn-ghost !px-2"
                  aria-label="Következő hónap"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-muted">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="py-1.5">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.date) ?? [];
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                    className={`flex min-h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-20 sm:p-2 ${
                      isSelected
                        ? "border-bronze bg-bronze/10"
                        : isToday
                          ? "border-bronze/60 bg-ivory-dim/60"
                          : "border-transparent hover:bg-ivory-dim/60"
                    } ${cell.inMonth ? "" : "opacity-40"}`}
                  >
                    <span
                      className={`text-xs font-medium ${isToday ? "font-semibold text-bronze" : "text-forest"}`}
                    >
                      {cell.day}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {dayEvents.slice(0, 4).map((ev) => (
                          <span key={ev.id} className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[ev.category]}`} />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className="text-[10px] leading-none text-muted">+{dayEvents.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="card mt-4 animate-fade-in p-4 sm:p-5">
              <h3 className="font-serif text-base text-forest">
                {new Intl.DateTimeFormat("hu-HU", { dateStyle: "long" }).format(new Date(`${selectedDate}T00:00:00`))}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Ezen a napon nincs esemény.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {selectedEvents.map((ev) => (
                    <li key={ev.id}>
                      <Link
                        href={ev.href}
                        className="flex items-center gap-2.5 py-2.5 text-sm text-forest hover:text-bronze"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[ev.category]}`} />
                        <span className="min-w-0 flex-1 truncate">{ev.title}</span>
                        <span className="shrink-0 text-xs text-muted">{CALENDAR_CATEGORIES[ev.category].label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
