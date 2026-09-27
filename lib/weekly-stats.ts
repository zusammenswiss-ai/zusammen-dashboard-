// Shared "Heti/Havi statisztika" data-fetch + computation — used by both
// WeeklyMonthlyStatsWidget (Áttekintés) and the Jegyzőkönyvek modul's
// "Pillanatkép mentése" (see app/(dashboard)/protocols). Kept in one
// place so the two can never drift on what a given number actually
// counts — a jegyzőkönyv snapshot must show exactly the same figures
// the widget would show at that moment.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrencyCode, Database } from "@/lib/supabase/types";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";

export type StatsPeriod = "week" | "month";

type RawRow = { date: string };
type RawMoneyRow = { date: string; amount: number; currency: CurrencyCode };
type RawTaskRow = { created_at: string; updated_at: string; status: string };
type RawContentRow = { created_at: string; content_type: string; status: string };

export type RawStatsData = {
  supplierReplies: RawRow[]; // updated_at of suppliers with reply_received=true
  tasks: RawTaskRow[];
  demandResponses: RawRow[];
  campaignContent: RawContentRow[];
  revenue: RawMoneyRow[];
  expenses: RawMoneyRow[];
  activityDates: string[]; // created_at of suppliers/documents/future_plans/orders (tasks counted separately)
};

export type PeriodStats = {
  supplierReplies: number;
  tasksClosed: number;
  tasksOpened: number;
  demandSignups: number;
  campaignsSent: number;
  revenueTotal: number;
  expenseTotal: number;
  activityEntries: number;
};

export function startOfISOWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  date.setDate(date.getDate() + diff);
  return date;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

/** [currentStart, currentEnd), [previousStart, previousEnd) — "current" runs
 * from the period start up to now (period-to-date), "previous" is the full
 * prior week/month, same convention any business dashboard uses for a
 * period-to-date vs. prior-full-period comparison. */
export function periodRanges(period: StatsPeriod, now: Date) {
  if (period === "week") {
    const currentStart = startOfISOWeek(now);
    const previousStart = addDays(currentStart, -7);
    return { currentStart, currentEnd: now, previousStart, previousEnd: currentStart };
  }
  const currentStart = startOfMonth(now);
  const previousStart = addMonths(currentStart, -1);
  return { currentStart, currentEnd: now, previousStart, previousEnd: currentStart };
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function computeStats(
  data: RawStatsData,
  start: Date,
  end: Date,
  currency: CurrencyCode,
  rates: ExchangeRates | null
): PeriodStats {
  const supplierReplies = data.supplierReplies.filter((r) => inRange(r.date, start, end)).length;
  const tasksClosed = data.tasks.filter((t) => t.status === "Kész" && inRange(t.updated_at, start, end)).length;
  const tasksOpened = data.tasks.filter((t) => inRange(t.created_at, start, end)).length;
  const demandSignups = data.demandResponses.filter((r) => inRange(r.date, start, end)).length;
  const campaignsSent = data.campaignContent.filter(
    (c) => c.content_type === "Email" && c.status === "Kiküldve" && inRange(c.created_at, start, end)
  ).length;
  const revenueTotal = data.revenue
    .filter((r) => inRange(r.date, start, end))
    .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, currency, rates), 0);
  const expenseTotal = data.expenses
    .filter((r) => inRange(r.date, start, end))
    .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, currency, rates), 0);
  const activityEntries =
    data.activityDates.filter((d) => inRange(d, start, end)).length +
    data.tasks.filter((t) => inRange(t.created_at, start, end)).length;

  return { supplierReplies, tasksClosed, tasksOpened, demandSignups, campaignsSent, revenueTotal, expenseTotal, activityEntries };
}

/** null = no meaningful % (previous period was 0); callers show an "Új"
 * badge instead in that case rather than a divide-by-zero percentage. */
export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export async function loadRawStatsData(supabase: SupabaseClient<Database>): Promise<RawStatsData> {
  const [suppliersRes, tasksRes, demandRes, contentRes, revenueRes, expensesRes, documentsRes, plansRes, ordersRes] =
    await Promise.all([
      supabase.from("suppliers").select("reply_received, updated_at"),
      supabase.from("tasks").select("status, created_at, updated_at"),
      supabase.from("landing_responses").select("created_at"),
      supabase.from("marketing_content").select("content_type, status, created_at"),
      supabase.from("revenue").select("amount, currency, revenue_date"),
      supabase.from("expenses").select("amount, currency, expense_date"),
      supabase.from("documents").select("created_at"),
      supabase.from("future_plans").select("created_at"),
      supabase.from("orders").select("created_at"),
    ]);

  return {
    supplierReplies: (suppliersRes.data ?? [])
      .filter((s) => s.reply_received)
      .map((s) => ({ date: s.updated_at })),
    tasks: (tasksRes.data ?? []).map((t) => ({ created_at: t.created_at, updated_at: t.updated_at, status: t.status })),
    demandResponses: (demandRes.data ?? []).map((r) => ({ date: r.created_at })),
    campaignContent: (contentRes.data ?? []).map((c) => ({
      created_at: c.created_at,
      content_type: c.content_type,
      status: c.status,
    })),
    revenue: (revenueRes.data ?? []).map((r) => ({ date: r.revenue_date, amount: r.amount, currency: r.currency })),
    expenses: (expensesRes.data ?? []).map((e) => ({ date: e.expense_date, amount: e.amount, currency: e.currency })),
    activityDates: [
      ...(suppliersRes.data ?? []).map((s) => s.updated_at),
      ...(documentsRes.data ?? []).map((d) => d.created_at),
      ...(plansRes.data ?? []).map((p) => p.created_at),
      ...(ordersRes.data ?? []).map((o) => o.created_at),
    ],
  };
}

export type WeeklyStatsSnapshot = PeriodStats & {
  currency: CurrencyCode;
  periodStart: string;
  periodEnd: string;
  computedAt: string;
};

/**
 * Egy pillanatra befagyasztott heti statisztika — a Jegyzőkönyvek modul
 * "Pillanatkép mentése" gombja ezt hívja, és a visszaadott objektumot
 * elmenti a protocols.stats_snapshot jsonb oszlopba. Onnantól ez a
 * bejegyzés soha többé nem számolódik újra — még ha a mögöttes adatok
 * (feladatok, bevételek, stb.) változnak is, ez a rekord a mentés
 * pillanatában látott számokat őrzi (lásd a schema.sql
 * protect_protocol_stats_snapshot trigger kommentjét).
 */
export async function computeCurrentWeekSnapshot(
  supabase: SupabaseClient<Database>,
  currency: CurrencyCode,
  rates: ExchangeRates | null
): Promise<WeeklyStatsSnapshot> {
  const data = await loadRawStatsData(supabase);
  const now = new Date();
  const { currentStart, currentEnd } = periodRanges("week", now);
  const stats = computeStats(data, currentStart, currentEnd, currency, rates);
  return {
    ...stats,
    currency,
    periodStart: currentStart.toISOString(),
    periodEnd: currentEnd.toISOString(),
    computedAt: now.toISOString(),
  };
}

export const STATS_ROW_LABELS: { key: keyof PeriodStats; label: string }[] = [
  { key: "supplierReplies", label: "Új beszállítói válaszok" },
  { key: "tasksClosed", label: "Lezárt feladatok" },
  { key: "tasksOpened", label: "Új feladatok" },
  { key: "demandSignups", label: "Demand-test / First 20 új jelentkezők" },
  { key: "campaignsSent", label: "Kiküldött kampányok" },
  { key: "revenueTotal", label: "Rögzített bevétel" },
  { key: "expenseTotal", label: "Rögzített kiadás" },
  { key: "activityEntries", label: "Aktivitás-napló bejegyzések" },
];
