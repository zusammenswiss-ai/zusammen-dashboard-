"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, ArrowUp, ArrowDown } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CurrencyCode } from "@/lib/supabase/types";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";
import { formatMoney } from "@/lib/currency";
import { Spinner } from "@/components/Feedback";

type Period = "week" | "month";

type RawRow = { date: string };
type RawMoneyRow = { date: string; amount: number; currency: CurrencyCode };
type RawTaskRow = { created_at: string; updated_at: string; status: string };
type RawContentRow = { created_at: string; content_type: string; status: string };

type RawData = {
  supplierReplies: RawRow[]; // updated_at of suppliers with reply_received=true
  tasks: RawTaskRow[];
  demandResponses: RawRow[];
  campaignContent: RawContentRow[];
  revenue: RawMoneyRow[];
  expenses: RawMoneyRow[];
  activityDates: string[]; // created_at of suppliers/documents/future_plans/orders (tasks counted separately)
};

type PeriodStats = {
  supplierReplies: number;
  tasksClosed: number;
  tasksOpened: number;
  demandSignups: number;
  campaignsSent: number;
  revenueTotal: number;
  expenseTotal: number;
  activityEntries: number;
};

function startOfISOWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

/** [currentStart, currentEnd), [previousStart, previousEnd) — "current" runs
 * from the period start up to now (period-to-date), "previous" is the full
 * prior week/month, same convention any business dashboard uses for a
 * period-to-date vs. prior-full-period comparison. */
function periodRanges(period: Period, now: Date) {
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

function computeStats(data: RawData, start: Date, end: Date, currency: CurrencyCode, rates: ExchangeRates | null): PeriodStats {
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

/** null = no meaningful % (previous period was 0); the row shows an "Új"
 * badge instead in that case rather than a divide-by-zero percentage. */
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * "Ez a hét" / "Ez a hónap" összesítő — period-to-date counts from
 * across the founder-facing tables, each compared to the prior full
 * week/month. Deliberately just numbers + a %/"Új" badge, no charts —
 * see the feature request this was built from. Fetches its own data
 * (narrow selects, one Promise.all) rather than folding into the
 * Áttekintés page's already-large main load effect.
 */
export default function WeeklyMonthlyStatsWidget({
  currency,
  rates,
}: {
  currency: CurrencyCode;
  rates: ExchangeRates | null;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
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

    setData({
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
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="card p-5">
        <Spinner />
      </div>
    );
  }

  const now = new Date();
  const { currentStart, currentEnd, previousStart, previousEnd } = periodRanges(period, now);
  const current = computeStats(data, currentStart, currentEnd, currency, rates);
  const previous = computeStats(data, previousStart, previousEnd, currency, rates);

  const rows: { label: string; value: string | number; curr: number; prev: number }[] = [
    { label: "Új beszállítói válaszok", value: current.supplierReplies, curr: current.supplierReplies, prev: previous.supplierReplies },
    { label: "Lezárt feladatok", value: current.tasksClosed, curr: current.tasksClosed, prev: previous.tasksClosed },
    { label: "Új feladatok", value: current.tasksOpened, curr: current.tasksOpened, prev: previous.tasksOpened },
    {
      label: "Demand-test / First 20 új jelentkezők",
      value: current.demandSignups,
      curr: current.demandSignups,
      prev: previous.demandSignups,
    },
    { label: "Kiküldött kampányok", value: current.campaignsSent, curr: current.campaignsSent, prev: previous.campaignsSent },
    {
      label: "Rögzített bevétel",
      value: formatMoney(current.revenueTotal, currency),
      curr: current.revenueTotal,
      prev: previous.revenueTotal,
    },
    {
      label: "Rögzített kiadás",
      value: formatMoney(current.expenseTotal, currency),
      curr: current.expenseTotal,
      prev: previous.expenseTotal,
    },
    {
      label: "Aktivitás-napló bejegyzések",
      value: current.activityEntries,
      curr: current.activityEntries,
      prev: previous.activityEntries,
    },
  ];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={17} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">Heti/Havi statisztika</h2>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-ivory-dim p-1 text-xs">
          <button
            onClick={() => setPeriod("week")}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              period === "week" ? "bg-white text-forest shadow-sm" : "text-muted hover:text-forest"
            }`}
          >
            Ez a hét
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              period === "month" ? "bg-white text-forest shadow-sm" : "text-muted hover:text-forest"
            }`}
          >
            Ez a hónap
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        Kampányok megnyitási aránya egyelőre nem elérhető — a jelenlegi Brevo-integráció tranzakciós leveleket
        küld, nem méri a megnyitásokat.
      </p>
      <div className="mt-3 flex flex-col divide-y divide-border">
        {rows.map((row) => {
          const pct = pctChange(row.curr, row.prev);
          const isNew = row.prev === 0 && row.curr !== 0;
          return (
            <div key={row.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-forest">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg text-forest">{row.value}</span>
                {isNew ? (
                  <span className="badge bg-forest/10 text-forest">Új</span>
                ) : pct !== null ? (
                  <span className={`badge ${pct >= 0 ? "bg-forest/10 text-forest" : "bg-red-100 text-red-700"}`}>
                    {pct >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                    {Math.abs(Math.round(pct))}%
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        {period === "week" ? "Ez a hét" : "Ez a hónap"} az eddig eltelt napokra, az előző időszakhoz képest
        (teljes előző hét/hónap).
      </p>
    </div>
  );
}
