"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Budget, BudgetInsert, BudgetPeriod, CurrencyCode, Expense, Revenue } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { EXPENSE_CATEGORIES, BUDGET_PERIODS } from "@/lib/labels";
import { compareBudgetToActual, annualTarget, BUDGET_REVENUE_CATEGORY } from "@/lib/finance-budget";
import type { ExchangeRates } from "@/lib/exchange-rates";

const BUDGET_CATEGORIES = [BUDGET_REVENUE_CATEGORY, ...EXPENSE_CATEGORIES];

function periodLabel(b: Budget): string {
  if (b.period === "Havi") return `${b.year}. ${String(b.month).padStart(2, "0")}. hó`;
  if (b.period === "Negyedéves") return `${b.year}. Q${b.quarter}`;
  return `${b.year}. év`;
}

export default function BudgetTab({
  budgets,
  expenses,
  revenue,
  currency,
  rates,
  onAdd,
  onDelete,
}: {
  budgets: Budget[];
  expenses: Expense[];
  revenue: Revenue[];
  currency: CurrencyCode;
  rates: ExchangeRates | null;
  onAdd: (b: Budget) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  const comparison = useMemo(
    () => compareBudgetToActual(budgets, expenses, revenue, currency, rates),
    [budgets, expenses, revenue, currency, rates]
  );
  const target = useMemo(
    () => annualTarget(budgets, expenses, revenue, currency, rates),
    [budgets, expenses, revenue, currency, rates]
  );

  function deleteBudget(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    onDelete(id);
    void supabase.from("budgets").delete().eq("id", id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">Éves célegyenleg</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          A &quot;{BUDGET_REVENUE_CATEGORY}&quot; kategóriájú, Éves gyakoriságú költségvetési sorok adják a tervezett bevételt; minden más Éves sor a
          tervezett költséget. {currency}-ra átváltva.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-ivory-dim px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Tervezett eredmény</p>
            <p className={`mt-1 font-serif text-xl ${target.plannedResult < 0 ? "text-red-600" : "text-forest"}`}>
              {formatMoney(target.plannedResult, currency)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatMoney(target.plannedRevenue, currency)} bevétel − {formatMoney(target.plannedExpense, currency)} költség
            </p>
          </div>
          <div className="rounded-lg bg-ivory-dim px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Tényleges eredmény (eddig, idén)</p>
            <p className={`mt-1 font-serif text-xl ${target.actualResult < 0 ? "text-red-600" : "text-forest"}`}>
              {formatMoney(target.actualResult, currency)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatMoney(target.actualRevenue, currency)} bevétel − {formatMoney(target.actualExpense, currency)} költség
            </p>
          </div>
          <div className="rounded-lg bg-ivory-dim px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Terv teljesülése</p>
            <p className="mt-1 font-serif text-xl text-forest">
              {target.plannedResult !== 0 ? `${((target.actualResult / target.plannedResult) * 100).toFixed(0)}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">a tervezett éves eredményhez képest</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-forest">Költségvetési sorok {budgets.length > 0 && `(${budgets.length})`}</h2>
          <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} /> Új költségvetési sor
          </button>
        </div>

        {showForm && (
          <BudgetForm
            onCreated={(b) => {
              onAdd(b);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {budgets.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Még nincs költségvetési sor"
            description="Adj meg egy tervezett összeget kategóriánként, hogy lásd a Tervezett vs. Tényleges összevetést."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Kategória</th>
                  <th className="px-4 py-3 font-medium">Időszak</th>
                  <th className="px-4 py-3 font-medium">Tervezett</th>
                  <th className="px-4 py-3 font-medium">Tényleges</th>
                  <th className="px-4 py-3 font-medium">Eltérés</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.budget.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium text-forest">{row.budget.category}</td>
                    <td className="px-4 py-2 text-muted">{periodLabel(row.budget)}</td>
                    <td className="px-4 py-2 text-forest">{formatMoney(row.planned, currency)}</td>
                    <td className="px-4 py-2 text-forest">{formatMoney(row.actual, currency)}</td>
                    <td className={`px-4 py-2 font-medium ${row.diff < 0 ? "text-red-600" : "text-green-700"}`}>
                      {formatMoney(row.diff, currency)}
                      {row.diffPct != null && <span className="ml-1 text-xs font-normal">({row.diffPct.toFixed(0)}%)</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => deleteBudget(row.budget.id)} className="text-muted/70 hover:text-red-600" title="Törlés">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  category: BUDGET_CATEGORIES[0],
  period: "Havi" as BudgetPeriod,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  quarter: Math.floor(new Date().getMonth() / 3) + 1,
  planned_amount: "",
  currency: "CHF" as CurrencyCode,
};

function BudgetForm({ onCreated, onCancel }: { onCreated: (b: Budget) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const amount = Number(form.planned_amount);
    if (!supabase || !Number.isFinite(amount) || amount <= 0) {
      setError("Adj meg egy pozitív tervezett összeget.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: BudgetInsert = {
      category: form.category,
      period: form.period,
      year: form.year,
      month: form.period === "Havi" ? form.month : null,
      quarter: form.period === "Negyedéves" ? form.quarter : null,
      planned_amount: amount,
      currency: form.currency,
    };
    const { data, error: insertError } = await supabase.from("budgets").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Időszak</label>
          <select className="select" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as BudgetPeriod }))}>
            {BUDGET_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Év</label>
          <input
            type="number"
            className="input"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
          />
        </div>
        {form.period === "Havi" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Hónap</label>
            <select className="select" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
        {form.period === "Negyedéves" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Negyedév</label>
            <select className="select" value={form.quarter} onChange={(e) => setForm((f) => ({ ...f, quarter: Number(e.target.value) }))}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tervezett összeg *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className="input"
            value={form.planned_amount}
            onChange={(e) => setForm((f) => ({ ...f, planned_amount: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Pénznem</label>
          <select className="select" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as CurrencyCode }))}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Sor mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}
