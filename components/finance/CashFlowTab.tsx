"use client";

import { useMemo, useState } from "react";
import { Wallet, TrendingUp } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CurrencyCode, Expense, Revenue } from "@/lib/supabase/types";
import { formatMoney } from "@/lib/currency";
import { buildCashFlowProjection } from "@/lib/finance-budget";
import type { ExchangeRates } from "@/lib/exchange-rates";

const CHART_HEIGHT = 140;
const COL_WIDTH = 64;

export default function CashFlowTab({
  expenses,
  revenue,
  bankBalance,
  currency,
  rates,
  onBankBalanceSaved,
}: {
  expenses: Expense[];
  revenue: Revenue[];
  bankBalance: number | null;
  currency: CurrencyCode;
  rates: ExchangeRates | null;
  onBankBalanceSaved: (value: number) => void;
}) {
  const [balanceInput, setBalanceInput] = useState(bankBalance != null ? String(bankBalance) : "");
  const [saving, setSaving] = useState(false);

  const months = useMemo(
    () => buildCashFlowProjection(expenses, revenue, bankBalance ?? 0, currency, rates),
    [expenses, revenue, bankBalance, currency, rates]
  );

  async function saveBalance(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const value = Number(balanceInput);
    if (!supabase || !Number.isFinite(value)) return;
    setSaving(true);
    const { data } = await supabase
      .from("company_settings")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      await supabase.from("company_settings").update({ bank_balance: value }).eq("id", data.id);
    } else {
      await supabase.from("company_settings").insert({ bank_balance: value });
    }
    setSaving(false);
    onBankBalanceSaved(value);
  }

  const minBalance = Math.min(0, ...months.map((m) => m.projectedBalance));
  const maxBalance = Math.max(1, ...months.map((m) => m.projectedBalance));
  const range = maxBalance - minBalance || 1;
  const chartWidth = months.length * COL_WIDTH;

  function yFor(value: number) {
    return CHART_HEIGHT - ((value - minBalance) / range) * CHART_HEIGHT;
  }

  const linePoints = months.map((m, i) => `${i * COL_WIDTH + COL_WIDTH / 2},${yFor(m.projectedBalance)}`).join(" ");
  const zeroY = yFor(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">Jelenlegi bankegyenleg</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Kézzel frissítendő kiindulópont — a lenti projekció innen indulva halmozza a várható havi
          bevétel−kiadás egyenleget, {currency}-ban.
        </p>
        <form onSubmit={saveBalance} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Egyenleg ({currency})</label>
            <input
              type="number"
              step="0.01"
              className="input w-40"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
            />
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary !py-2">
            {saving ? "Mentés…" : "Mentés"}
          </button>
        </form>
      </div>

      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <TrendingUp size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">Várható egyenleg — következő {months.length} hónap</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Várható bevétel (az elmúlt hónapok átlaga, vagy a már rögzített tétel) mínusz várható kiadás (ismétlődő
          fix költségek havi egyenértéke + a hónapra már dátumozott egyszeri tételek).
        </p>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT + 24}`}
            width={Math.max(chartWidth, 320)}
            height={CHART_HEIGHT + 24}
            role="img"
            aria-label="Projektált bankegyenleg havi bontásban"
          >
            <line x1={0} y1={zeroY} x2={chartWidth} y2={zeroY} stroke="var(--border, #e2d9c6)" strokeWidth={1} strokeDasharray="3,3" />
            <polyline points={linePoints} fill="none" stroke="#2a78d6" strokeWidth={2} />
            {months.map((m, i) => (
              <g key={m.key}>
                <circle cx={i * COL_WIDTH + COL_WIDTH / 2} cy={yFor(m.projectedBalance)} r={3} fill={m.projectedBalance < 0 ? "#dc2626" : "#2a78d6"}>
                  <title>
                    {m.label}: {formatMoney(m.projectedBalance, currency)}
                  </title>
                </circle>
                <text x={i * COL_WIDTH + COL_WIDTH / 2} y={CHART_HEIGHT + 16} textAnchor="middle" fontSize="9" fill="var(--muted, #8a8172)">
                  {m.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left uppercase tracking-wide text-muted">
                <th className="px-2 py-1.5 font-medium">Hónap</th>
                <th className="px-2 py-1.5 font-medium">Várható bevétel</th>
                <th className="px-2 py-1.5 font-medium">Várható kiadás</th>
                <th className="px-2 py-1.5 font-medium">Nettó</th>
                <th className="px-2 py-1.5 font-medium">Projektált egyenleg</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-forest">{m.label}</td>
                  <td className="px-2 py-1.5 text-forest">{formatMoney(m.expectedRevenue, currency)}</td>
                  <td className="px-2 py-1.5 text-forest">{formatMoney(m.expectedExpense, currency)}</td>
                  <td className={`px-2 py-1.5 font-medium ${m.net < 0 ? "text-red-600" : "text-forest"}`}>{formatMoney(m.net, currency)}</td>
                  <td className={`px-2 py-1.5 font-medium ${m.projectedBalance < 0 ? "text-red-600" : "text-forest"}`}>
                    {formatMoney(m.projectedBalance, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
