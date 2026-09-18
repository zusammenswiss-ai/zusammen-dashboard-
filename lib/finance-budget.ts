// Shared math for the Pénzügyek → Költségvetés / Cash Flow / ÁFA-MWST
// tabs — kept separate from lib/finance.ts (which backs the older
// break-even calculator + havi trend) since these three read from the
// new budgets/revenue tables instead of just expenses/orders/products.
import type { Budget, CurrencyCode, Expense, Revenue } from "@/lib/supabase/types";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";
import { monthlyEquivalent } from "@/lib/finance";

/** The calendar bucket a budget line applies to, as a "YYYY" (Éves),
 * "YYYY-MM" (Havi) or "YYYY-Qn" (Negyedéves) key — same shape used to
 * bucket actual expenses/revenue below, so the two sides of a
 * Tervezett/Tényleges comparison line up on the same key. */
function budgetKey(b: Pick<Budget, "period" | "year" | "month" | "quarter">): string {
  if (b.period === "Havi") return `${b.year}-${String(b.month).padStart(2, "0")}`;
  if (b.period === "Negyedéves") return `${b.year}-Q${b.quarter}`;
  return `${b.year}`;
}

function dateToQuarter(dateStr: string): number {
  return Math.floor((Number(dateStr.slice(5, 7)) - 1) / 3) + 1;
}

// A budgets row's `category` is normally one of expenses.category's
// values (a cost line) — this one special value lets the same table
// also carry a planned *revenue* figure (needed for the "Éves
// célegyenleg" — tervezett bevétel mínusz tervezett költség), compared
// against the revenue table instead of expenses below.
export const BUDGET_REVENUE_CATEGORY = "Bevétel";

function inBudgetWindow(dateStr: string, budget: Pick<Budget, "period" | "year" | "month" | "quarter">): boolean {
  const year = dateStr.slice(0, 4);
  if (budget.period === "Éves") return year === String(budget.year);
  if (budget.period === "Havi") return dateStr.slice(0, 7) === budgetKey(budget);
  return `${year}-Q${dateToQuarter(dateStr)}` === budgetKey(budget);
}

/**
 * One category's Tervezett vs. Tényleges for one budget line, both
 * converted into `to`. `actual` sums every expense in that category
 * (or, for BUDGET_REVENUE_CATEGORY, every revenue row) whose date falls
 * in the same year + period-bucket as the budget line (Havi → same
 * month, Negyedéves → same quarter, Éves → same year) — a category can
 * have both a Havi and an Éves budget line at once, each compared
 * against the actual figure in its own window. For a cost category,
 * diff = planned - actual (positive = under budget, green); for the
 * revenue category the sign is flipped (positive = over target, still
 * green) — see isRevenue on the returned row.
 */
export type BudgetComparisonRow = {
  budget: Budget;
  isRevenue: boolean;
  actual: number;
  planned: number;
  diff: number;
  diffPct: number | null; // diff / planned * 100, null when planned is 0
};

export function compareBudgetToActual(
  budgets: Budget[],
  expenses: Expense[],
  revenue: Revenue[],
  to: CurrencyCode,
  rates: ExchangeRates | null
): BudgetComparisonRow[] {
  return budgets.map((budget) => {
    const isRevenue = budget.category === BUDGET_REVENUE_CATEGORY;
    const actual = isRevenue
      ? revenue
          .filter((r) => inBudgetWindow(r.revenue_date, budget))
          .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, to, rates), 0)
      : expenses
          .filter((e) => e.category === budget.category)
          .filter((e) => inBudgetWindow(e.expense_date, budget))
          .reduce((sum, e) => sum + convertAmount(e.amount, e.currency, to, rates), 0);
    const planned = convertAmount(budget.planned_amount, budget.currency, to, rates);
    const diff = isRevenue ? actual - planned : planned - actual;
    return { budget, isRevenue, actual, planned, diff, diffPct: planned > 0 ? (diff / planned) * 100 : null };
  });
}

export type AnnualTarget = {
  plannedRevenue: number;
  plannedExpense: number;
  plannedResult: number;
  actualRevenue: number;
  actualExpense: number;
  actualResult: number;
};

/**
 * Éves célegyenleg — every Éves-period budget line for `year`, summed
 * separately for the revenue category vs. every cost category, next to
 * what's actually been logged into revenue/expenses so far this year.
 * Havi/Negyedéves budget lines aren't included here (they're already
 * visible per-category in the Tervezett/Tényleges table above) to avoid
 * double-counting a category that has both an Éves and a Havi line.
 */
export function annualTarget(
  budgets: Budget[],
  expenses: Expense[],
  revenue: Revenue[],
  to: CurrencyCode,
  rates: ExchangeRates | null,
  year: number = new Date().getFullYear()
): AnnualTarget {
  const yearly = budgets.filter((b) => b.period === "Éves" && b.year === year);
  const plannedRevenue = yearly
    .filter((b) => b.category === BUDGET_REVENUE_CATEGORY)
    .reduce((sum, b) => sum + convertAmount(b.planned_amount, b.currency, to, rates), 0);
  const plannedExpense = yearly
    .filter((b) => b.category !== BUDGET_REVENUE_CATEGORY)
    .reduce((sum, b) => sum + convertAmount(b.planned_amount, b.currency, to, rates), 0);
  const actualRevenue = revenue
    .filter((r) => r.revenue_date.startsWith(String(year)))
    .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, to, rates), 0);
  const actualExpense = expenses
    .filter((e) => e.expense_date.startsWith(String(year)))
    .reduce((sum, e) => sum + convertAmount(e.amount, e.currency, to, rates), 0);
  return {
    plannedRevenue,
    plannedExpense,
    plannedResult: plannedRevenue - plannedExpense,
    actualRevenue,
    actualExpense,
    actualResult: actualRevenue - actualExpense,
  };
}

export type MonthlyCashFlow = {
  key: string; // "2026-08"
  label: string;
  expectedRevenue: number;
  expectedExpense: number;
  net: number;
  projectedBalance: number;
};

const MONTH_LABEL = new Intl.DateTimeFormat("hu-HU", { month: "short", year: "numeric" });

/**
 * A simple forward projection, month by month: each month's expected
 * expense is every currently-recurring expense's monthly-equivalent
 * (see lib/finance.ts's monthlyEquivalent — same normalization the
 * break-even calculator uses) plus any one-off expense already dated
 * into that future month; expected revenue is the average of the last
 * `lookbackMonths` months' logged revenue (a simple run-rate estimate —
 * there's no sales forecast in this app to draw on instead) plus any
 * revenue row already dated into that future month. startingBalance is
 * the founder-entered "Jelenlegi bankegyenleg", carried forward and
 * accumulated by each month's net.
 */
export function buildCashFlowProjection(
  expenses: Expense[],
  revenue: Revenue[],
  startingBalance: number,
  to: CurrencyCode,
  rates: ExchangeRates | null,
  monthsForward = 6,
  lookbackMonths = 3
): MonthlyCashFlow[] {
  const today = new Date();
  const recurringMonthly = expenses.reduce(
    (sum, e) => sum + convertAmount(monthlyEquivalent(e), e.currency, to, rates),
    0
  );

  const lookbackCutoff = new Date(today.getFullYear(), today.getMonth() - lookbackMonths, 1);
  const recentRevenue = revenue
    .filter((r) => new Date(r.revenue_date) >= lookbackCutoff)
    .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, to, rates), 0);
  const avgMonthlyRevenue = recentRevenue / lookbackMonths;

  const oneOffByMonth = new Map<string, number>();
  for (const e of expenses) {
    if (e.is_recurring) continue; // already folded into recurringMonthly above
    const key = e.expense_date.slice(0, 7);
    oneOffByMonth.set(key, (oneOffByMonth.get(key) ?? 0) + convertAmount(e.amount, e.currency, to, rates));
  }
  const datedRevenueByMonth = new Map<string, number>();
  for (const r of revenue) {
    const key = r.revenue_date.slice(0, 7);
    datedRevenueByMonth.set(key, (datedRevenueByMonth.get(key) ?? 0) + convertAmount(r.amount, r.currency, to, rates));
  }

  let balance = startingBalance;
  const months: MonthlyCashFlow[] = [];
  for (let i = 0; i < monthsForward; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    // The current (i = 0) month uses whatever revenue/one-off expenses
    // are already logged for it instead of the run-rate estimate, since
    // that's more accurate than guessing a month already in progress.
    const expectedRevenue = i === 0 && datedRevenueByMonth.has(key) ? datedRevenueByMonth.get(key)! : avgMonthlyRevenue;
    const expectedExpense = recurringMonthly + (oneOffByMonth.get(key) ?? 0);
    const net = expectedRevenue - expectedExpense;
    balance += net;
    months.push({ key, label: MONTH_LABEL.format(d), expectedRevenue, expectedExpense, net, projectedBalance: balance });
  }
  return months;
}

// Svájc: CHF 100'000 éves árbevétel felett kötelező a MWST-regisztráció
// (Mehrwertsteuer / TVA / ÁFA). Csak egy vizuális küszöb-mérő — nincs
// automatikus bejelentés vagy figyelmeztető email, ez a founder saját
// felelőssége marad, ez csak segít látni, hol tart.
export const VAT_THRESHOLD_CHF = 100_000;

export function vatThresholdProgress(
  revenue: Revenue[],
  rates: ExchangeRates | null,
  year: number = new Date().getFullYear()
): { totalChf: number; pct: number } {
  const totalChf = revenue
    .filter((r) => r.revenue_date.startsWith(String(year)))
    .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, "CHF", rates), 0);
  return { totalChf, pct: Math.min(100, (totalChf / VAT_THRESHOLD_CHF) * 100) };
}
