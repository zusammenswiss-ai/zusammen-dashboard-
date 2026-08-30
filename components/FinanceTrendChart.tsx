"use client";

import { TrendingUp } from "lucide-react";
import type { MonthlyFinancials } from "@/lib/finance";
import type { CurrencyCode } from "@/lib/supabase/types";
import { formatMoney } from "@/lib/currency";

// Validated 3-slot categorical palette (dataviz skill's reference
// default, slots 1–3 — these three specifically clear the all-pairs CVD
// floor together, not just the adjacent-pair check most palettes only
// need). Not the app's own forest/bronze/walnut brand colors: those read
// as near-gray at small-mark size and fail the chroma-floor check, so
// they're reserved for text/surfaces/buttons as everywhere else in the
// app, and this chart borrows a palette actually built for data marks.
const SERIES = [
  { key: "revenue" as const, label: "Bevétel", color: "#2a78d6" },
  { key: "cogs" as const, label: "Önköltség", color: "#eb6834" },
  { key: "expenses" as const, label: "Kiadások", color: "#1baf7a" },
];

const CHART_HEIGHT = 160;
const BAR_WIDTH = 9;
const BAR_GAP = 2;
const GROUP_GAP = 14;
const GROUP_WIDTH = SERIES.length * BAR_WIDTH + (SERIES.length - 1) * BAR_GAP;

/**
 * Havi trend — bevétel/önköltség/kiadások grouped bar chart, last 6
 * hónap. A plain inline SVG (no charting library, matching this app's
 * zero-heavy-dependency convention elsewhere — self-built QR codes,
 * self-built .ics). Below the chart, a plain table repeats the same
 * numbers — required relief for the Kiadások (aqua) series, which sits
 * under the 3:1 contrast floor against a light surface at small size
 * (see the dataviz skill), and useful on its own as a copy-pasteable
 * summary regardless.
 */
export default function FinanceTrendChart({ months, currency }: { months: MonthlyFinancials[]; currency: CurrencyCode }) {
  const maxValue = Math.max(1, ...months.flatMap((m) => [m.revenue, m.cogs, m.expenses]));
  const chartWidth = months.length * (GROUP_WIDTH + GROUP_GAP);

  function barHeight(value: number) {
    return (value / maxValue) * CHART_HEIGHT;
  }

  // Rounded top corners only, flat baseline — a plain <rect rx> would
  // round all four corners, which reads wrong anchored to a shared axis.
  function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number) {
    const r = Math.min(radius, height, width / 2);
    if (height <= 0) return "";
    return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  }

  const hasData = months.some((m) => m.revenue || m.cogs || m.expenses);

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp size={16} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Havi trend</h2>
      </div>
      <p className="mb-4 text-sm text-muted">Bevétel, önköltség és kiadások az utolsó {months.length} hónapban.</p>

      {/* Legend — always present for ≥2 series. */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-forest">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {!hasData ? (
        <p className="rounded-md bg-ivory-dim px-3 py-6 text-center text-sm text-muted">
          Még nincs elég adat a trendhez — rögzíts szállított megrendeléseket (termékhez kapcsolva) és/vagy
          kiadásokat.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT + 24}`}
            width={Math.max(chartWidth, 320)}
            height={CHART_HEIGHT + 24}
            role="img"
            aria-label="Havi bevétel, önköltség és kiadás trend"
          >
            {/* Recessive baseline. */}
            <line
              x1={0}
              y1={CHART_HEIGHT}
              x2={chartWidth}
              y2={CHART_HEIGHT}
              stroke="var(--border, #e2d9c6)"
              strokeWidth={1}
            />
            {months.map((month, i) => {
              const groupX = i * (GROUP_WIDTH + GROUP_GAP);
              return (
                <g key={month.key}>
                  {SERIES.map((s, si) => {
                    const value = month[s.key];
                    const height = barHeight(value);
                    const x = groupX + si * (BAR_WIDTH + BAR_GAP);
                    return (
                      <path key={s.key} d={roundedTopBarPath(x, CHART_HEIGHT - height, BAR_WIDTH, height, 3)} fill={s.color}>
                        <title>
                          {month.label} · {s.label}: {formatMoney(value, currency)}
                        </title>
                      </path>
                    );
                  })}
                  <text
                    x={groupX + GROUP_WIDTH / 2}
                    y={CHART_HEIGHT + 16}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--muted, #8a8172)"
                  >
                    {month.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Table view — the same figures, always visible (not hover-gated). */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-wide text-muted">
              <th className="px-2 py-1.5 font-medium">Hónap</th>
              <th className="px-2 py-1.5 font-medium">Bevétel</th>
              <th className="px-2 py-1.5 font-medium">Önköltség</th>
              <th className="px-2 py-1.5 font-medium">Kiadások</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key} className="border-b border-border last:border-0">
                <td className="px-2 py-1.5 text-forest">{m.label}</td>
                <td className="px-2 py-1.5 text-forest">{formatMoney(m.revenue, currency)}</td>
                <td className="px-2 py-1.5 text-forest">{formatMoney(m.cogs, currency)}</td>
                <td className="px-2 py-1.5 text-forest">{formatMoney(m.expenses, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Az önköltség csak a termékhez kapcsolt megrendelésekből számol — lásd a &quot;Kapcsolt termék&quot; mezőt a
        Megrendeléseken.
      </p>
    </div>
  );
}
