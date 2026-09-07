"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarRange, Plus, Pencil, Trash2, List, LayoutGrid, GripVertical, X } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CalendarEvent as CalendarEventRow } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import CalendarEventModal from "@/components/CalendarEventModal";
import { CategoryIcon, CATEGORY_DOT } from "@/components/CalendarCategoryBadge";
import { useUndoAction } from "@/lib/useUndoAction";
import { CALENDAR_CATEGORIES, type CalendarCategory } from "@/lib/labels";
import { fetchAllCalendarEvents, type CalendarEventItem } from "@/lib/calendar-events";
import { formatDate } from "@/lib/format";

const WEEKDAY_LABELS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const HIDDEN_CATEGORIES_KEY = "naptar-hidden-categories";
const AGENDA_WINDOW_DAYS = 30;
const TASK_DRAG_MIME = "text/x-zusammen-task-id";
// Tailwind's `sm` breakpoint — below this, the month grid is cramped
// enough that Lista is the more usable default (still switchable).
const MOBILE_BREAKPOINT_PX = 640;

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
function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return toISODate(next.getFullYear(), next.getMonth(), next.getDate());
}

function loadHiddenCategories(): Set<CalendarCategory> {
  try {
    const raw = localStorage.getItem(HIDDEN_CATEGORIES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as CalendarCategory[]);
  } catch {
    return new Set();
  }
}

export default function CalendarPage() {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEventItem[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarEventRow[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [openDayModal, setOpenDayModal] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "list">("month");
  const [hiddenCategories, setHiddenCategories] = useState<Set<CalendarCategory>>(new Set());
  const [eventModal, setEventModal] = useState<{ event?: CalendarEventRow; defaultDate?: string } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiddenCategories(loadHiddenCategories());
    // Small screens default to Lista — the month grid's day cells get too
    // cramped to read at a glance below `sm`. Only sets the *default*: a
    // manual switch afterward is never overridden by a later resize.
    if (window.innerWidth < MOBILE_BREAKPOINT_PX) setView("list");
  }, []);

  const loadEvents = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [events, customRes] = await Promise.all([
        fetchAllCalendarEvents(supabase),
        supabase.from("calendar_events").select("*").order("date", { ascending: true }),
      ]);
      if (customRes.error) throw customRes.error;
      setAllEvents(events);
      setCustomEvents(customRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a naptár adatait.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadEvents();
  }, [supabase, loadEvents]);

  function toggleCategory(cat: CalendarCategory) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      try {
        localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify([...next]));
      } catch {
        // Non-fatal — the filter still works for this page load, it just won't persist.
      }
      return next;
    });
  }

  const visibleEvents = useMemo(
    () => allEvents.filter((ev) => !hiddenCategories.has(ev.category)),
    [allEvents, hiddenCategories]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of visibleEvents) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return map;
  }, [visibleEvents]);

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
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }

  const today = todayISO();
  const openDayEvents = openDayModal ? (eventsByDate.get(openDayModal) ?? []) : [];

  const agendaDays = useMemo(() => {
    if (view !== "list") return [];
    const until = addDaysISO(today, AGENDA_WINDOW_DAYS);
    const dates = [...eventsByDate.keys()].filter((d) => d >= today && d <= until).sort();
    return dates.map((date) => ({ date, events: eventsByDate.get(date) ?? [] }));
  }, [view, eventsByDate, today]);

  function customEventFor(ev: CalendarEventItem): CalendarEventRow | undefined {
    if (ev.category !== "event") return undefined;
    const id = ev.id.replace(/^event-/, "");
    return customEvents.find((c) => c.id === id);
  }

  function onEventSaved(saved: CalendarEventRow) {
    setCustomEvents((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev];
    });
    setAllEvents((prev) => {
      const item: CalendarEventItem = {
        id: `event-${saved.id}`,
        date: saved.date,
        title: saved.time ? `${saved.title} (${saved.time})` : saved.title,
        category: "event",
        href: "/calendar",
      };
      const exists = prev.some((e) => e.id === item.id);
      return exists ? prev.map((e) => (e.id === item.id ? item : e)) : [...prev, item];
    });
  }

  function deleteCustomEvent(row: CalendarEventRow) {
    if (!supabase) return;
    setAllEvents((prev) => prev.filter((e) => e.id !== `event-${row.id}`));
    setCustomEvents((prev) => prev.filter((e) => e.id !== row.id));
    scheduleUndo(
      `"${row.title}" esemény törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("calendar_events").delete().eq("id", row.id);
        if (deleteError) setError(deleteError.message);
      },
      () => onEventSaved(row)
    );
  }

  async function rescheduleTask(taskId: string, newDate: string) {
    if (!supabase) return;
    const eventId = `task-${taskId}`;
    const previous = allEvents.find((e) => e.id === eventId);
    setAllEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, date: newDate } : e)));
    const { error: updateError } = await supabase.from("tasks").update({ due_date: newDate }).eq("id", taskId);
    if (updateError) {
      setError(updateError.message);
      if (previous) setAllEvents((prev) => prev.map((e) => (e.id === eventId ? previous : e)));
    }
  }

  function handleDrop(date: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData(TASK_DRAG_MIME);
    if (taskId) void rescheduleTask(taskId, date);
  }

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
        subtitle="Minden határidő és esemény egy helyen, típus szerint színezve. Egy feladat-eseményt a napi listáról áthúzhatsz egy másik napra az átütemezéshez."
        action={
          <button
            type="button"
            className="btn btn-bronze"
            onClick={() => setEventModal({ defaultDate: openDayModal ?? today })}
          >
            <Plus size={16} /> Új esemény
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {(Object.keys(CALENDAR_CATEGORIES) as CalendarCategory[]).map((key) => {
                const hidden = hiddenCategories.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCategory(key)}
                    title={hidden ? "Megjelenítés" : "Elrejtés"}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                      hidden
                        ? "border-border text-muted/40 opacity-60"
                        : "border-border bg-white text-muted hover:border-bronze/40"
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[key]}`} />
                    {CALENDAR_CATEGORIES[key].label}
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "month" ? "bg-bronze text-white" : "text-muted hover:bg-ivory-dim"
                }`}
              >
                <LayoutGrid size={13} /> Hónap
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "list" ? "bg-bronze text-white" : "text-muted hover:bg-ivory-dim"
                }`}
              >
                <List size={13} /> Lista
              </button>
            </div>
          </div>

          {view === "month" ? (
            <div className="card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg capitalize text-forest">{monthLabel}</h2>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => shiftMonth(-1)} className="btn btn-ghost !px-2" aria-label="Előző hónap">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={goToday} className="btn btn-ghost !px-3 text-xs">
                    Ma
                  </button>
                  <button onClick={() => shiftMonth(1)} className="btn btn-ghost !px-2" aria-label="Következő hónap">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-border pb-2 text-center font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted/60">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 pt-1">
                {cells.map((cell) => {
                  const dayEvents = eventsByDate.get(cell.date) ?? [];
                  const isToday = cell.date === today;
                  const isDragOver = cell.date === dragOverDate;
                  return (
                    <button
                      key={cell.date}
                      onClick={() => setOpenDayModal(cell.date)}
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes(TASK_DRAG_MIME)) {
                          e.preventDefault();
                          if (dragOverDate !== cell.date) setDragOverDate(cell.date);
                        }
                      }}
                      onDragLeave={() => setDragOverDate((d) => (d === cell.date ? null : d))}
                      onDrop={(e) => handleDrop(cell.date, e)}
                      className={`flex min-h-16 flex-col items-center gap-1 rounded-xl border p-1.5 text-left transition-colors sm:min-h-20 sm:items-start sm:p-2 ${
                        isDragOver
                          ? "border-bronze bg-bronze/20"
                          : isToday
                            ? "border-2 border-bronze bg-bronze/5"
                            : "border-transparent hover:bg-ivory-dim/60"
                      } ${cell.inMonth ? "" : "opacity-40"}`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center text-xs sm:h-auto sm:w-auto ${
                          isToday
                            ? "rounded-full bg-bronze font-semibold text-white sm:h-5 sm:w-5"
                            : "font-medium text-forest"
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
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
          ) : (
            <div className="card p-4 sm:p-5">
              <h2 className="font-serif text-lg text-forest">Következő {AGENDA_WINDOW_DAYS} nap</h2>
              {agendaDays.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Nincs esemény a következő {AGENDA_WINDOW_DAYS} napban.</p>
              ) : (
                <div className="mt-3 flex flex-col divide-y divide-border">
                  {agendaDays.map(({ date, events }) => (
                    <div key={date} className="py-3 first:pt-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {date === today ? "Ma" : formatDate(date)}
                      </p>
                      <ul className="mt-1.5 flex flex-col divide-y divide-border">
                        {events.map((ev) => (
                          <EventRow
                            key={ev.id}
                            event={ev}
                            customEvent={customEventFor(ev)}
                            onEdit={(row) => setEventModal({ event: row })}
                            onDelete={deleteCustomEvent}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {openDayModal && (
        <DayEventsModal
          date={openDayModal}
          events={openDayEvents}
          customEventFor={customEventFor}
          onClose={() => setOpenDayModal(null)}
          onAddEvent={() => {
            setEventModal({ defaultDate: openDayModal });
            setOpenDayModal(null);
          }}
          onEdit={(row) => {
            setEventModal({ event: row });
            setOpenDayModal(null);
          }}
          onDelete={deleteCustomEvent}
        />
      )}

      {eventModal && (
        <CalendarEventModal
          event={eventModal.event}
          defaultDate={eventModal.defaultDate}
          onClose={() => setEventModal(null)}
          onSaved={onEventSaved}
        />
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}

/** Popup opened by clicking a day cell in the month grid — lists every
 * event on that day, each linking to its source (or, for hand-added
 * events, editable/deletable in place). Replaces the old inline
 * below-the-grid panel so the grid itself doesn't reflow when a day is
 * picked. */
function DayEventsModal({
  date,
  events,
  customEventFor,
  onClose,
  onAddEvent,
  onEdit,
  onDelete,
}: {
  date: string;
  events: CalendarEventItem[];
  customEventFor: (ev: CalendarEventItem) => CalendarEventRow | undefined;
  onClose: () => void;
  onAddEvent: () => void;
  onEdit: (row: CalendarEventRow) => void;
  onDelete: (row: CalendarEventRow) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px] sm:items-start sm:justify-end sm:p-0"
      onClick={onClose}
    >
      <div
        className="animate-fade-in flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:h-full sm:max-w-sm sm:rounded-none sm:border-y-0 sm:border-l sm:border-r-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-serif text-lg capitalize text-forest">
            {new Intl.DateTimeFormat("hu-HU", { dateStyle: "long" }).format(new Date(`${date}T00:00:00`))}
          </h2>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {events.length === 0 ? (
            <p className="text-sm text-muted">Ezen a napon nincs esemény.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {events.map((ev) => (
                <EventRow key={ev.id} event={ev} customEvent={customEventFor(ev)} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          <button type="button" className="btn btn-ghost w-full justify-center text-xs" onClick={onAddEvent}>
            <Plus size={14} /> Új esemény erre a napra
          </button>
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  customEvent,
  onEdit,
  onDelete,
}: {
  event: CalendarEventItem;
  customEvent?: CalendarEventRow;
  onEdit: (row: CalendarEventRow) => void;
  onDelete: (row: CalendarEventRow) => void;
}) {
  const draggable = event.category === "task";

  const inner = (
    <>
      {draggable && <GripVertical size={13} className="shrink-0 text-muted/40" />}
      <CategoryIcon category={event.category} />
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      <span className="shrink-0 text-xs text-muted">{CALENDAR_CATEGORIES[event.category].label}</span>
    </>
  );

  if (customEvent) {
    return (
      <li className="flex items-center gap-2.5 py-2.5 text-sm text-forest">
        {inner}
        <button
          type="button"
          onClick={() => onEdit(customEvent)}
          className="shrink-0 rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
          aria-label="Szerkesztés"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(customEvent)}
          className="shrink-0 rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-red-600"
          aria-label="Törlés"
        >
          <Trash2 size={13} />
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={event.href}
        draggable={draggable}
        onDragStart={
          draggable ? (e) => e.dataTransfer.setData(TASK_DRAG_MIME, event.id.replace(/^task-/, "")) : undefined
        }
        className={`flex items-center gap-2.5 py-2.5 text-sm text-forest hover:text-bronze ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {inner}
      </Link>
    </li>
  );
}
