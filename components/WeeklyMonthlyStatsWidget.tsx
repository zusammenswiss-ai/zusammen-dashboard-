"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, ArrowUp, ArrowDown } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CurrencyCode } from "@/lib/supabase/types";
import type { ExchangeRates } from "@/lib/exchange-rates";
import { formatMoney } from "@/lib/currency";
import { Spinner } from "@/components/Feedback";
import {
  loadRawStatsData,
  computeStats,
  periodRanges,
  pctChange,
  STATS_ROW_LABELS,
  type RawStatsData,
  type StatsPeriod,
} from "@/lib/weekly-stats";

/**
 * "Ez a hét" / "Ez a hónap" összesítő — period-to-date counts from
 * across the founder-facing tables, each compared to the prior full
 * week/month. Deliberately just numbers + a %/"Új" badge, no charts —
 * see the feature request this was built from. Fetches its own data
 * (narrow selects, one Promise.all) rather than folding into the
 * Áttekintés page's already-large main load effect. The actual fetch +
 * computation now lives in lib/weekly-stats.ts, shared with the
 * Jegyzőkönyvek modul's "Pillanatkép mentése" so the two never drift on
 * what a given number counts.
 */
export default function WeeklyMonthlyStatsWidget({
  currency,
  rates,
}: {
  currency: CurrencyCode;
  rates: ExchangeRates | null;
}) {
  const [period, setPeriod] = useState<StatsPeriod>("week");
  const [data, setData] = useState<RawStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    setData(await loadRawStatsData(supabase));
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

  const rows = STATS_ROW_LABELS.map(({ key, label }) => {
    const curr = current[key];
    const prev = previous[key];
    const isMoney = key === "revenueTotal" || key === "expenseTotal";
    return { label, value: isMoney ? formatMoney(curr, currency) : curr, curr, prev };
  });

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
