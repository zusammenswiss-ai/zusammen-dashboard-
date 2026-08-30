// Shared finance math for the Pénzügyek page — the break-even
// calculator, the havi trend chart's aggregation, and expected-vs-
// realized revenue all live here rather than inline in the page, so
// BreakEvenCalculator/FinanceTrendChart and the page itself can't drift
// on how a number is actually computed.
import type { CurrencyCode, Expense, Order, Product } from "@/lib/supabase/types";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";

/**
 * Normalizes a recurring expense down to its monthly-equivalent amount,
 * in the expense's own currency (not yet converted) — a Negyedéves
 * (quarterly) cost counts for 1/3 of its amount per month, Éves
 * (yearly) for 1/12, and so on. Non-recurring expenses contribute 0 —
 * they're a one-off transaction, not an ongoing commitment, so they
 * don't belong in a *fixed* monthly cost figure.
 */
export function monthlyEquivalent(expense: Expense): number {
  if (!expense.is_recurring || !expense.recurrence_type) return 0;
  switch (expense.recurrence_type) {
    case "Napi":
      return expense.amount * 30.44;
    case "Heti":
      return expense.amount * 4.345;
    case "Havi":
      return expense.amount;
    case "Negyedéves":
      return expense.amount / 3;
    case "Éves":
      return expense.amount / 12;
  }
}

/** Total fixed monthly cost across every currently-recurring expense, converted into `to`. */
export function fixedMonthlyCost(expenses: Expense[], to: CurrencyCode, rates: ExchangeRates | null): number {
  return expenses.reduce((sum, e) => sum + convertAmount(monthlyEquivalent(e), e.currency, to, rates), 0);
}

/**
 * Units per month needed to cover `fixedMonthly` at `marginPerUnit`
 * (both already in the same currency). Null when the product can never
 * break even at this price (margin at or below zero) — dividing by a
 * non-positive number would produce a meaningless or negative "units".
 */
export function breakEvenUnits(fixedMonthly: number, marginPerUnit: number): number | null {
  if (marginPerUnit <= 0) return null;
  return fixedMonthly / marginPerUnit;
}

export type MonthlyFinancials = {
  key: string; // "2026-08", for bucket lookup
  label: string; // "2026. aug.", for the chart axis
  revenue: number;
  cogs: number;
  expenses: number;
};

const MONTH_LABEL = new Intl.DateTimeFormat("hu-HU", { month: "short", year: "numeric" });

/**
 * The last `monthsBack` calendar months (oldest first, current month
 * included), each bucket summing real order revenue/COGS (only for
 * orders with both a delivery_date in that month and a linked
 * product_id — orders without a catalog link contribute revenue but not
 * COGS, same limitation as the "Tényleges bevétel" section) and logged
 * expenses dated in that month. Every figure is converted into `to`
 * first — see lib/exchange-rates.ts.
 */
export function buildMonthlyTrend(
  orders: Order[],
  products: Product[],
  expenses: Expense[],
  to: CurrencyCode,
  rates: ExchangeRates | null,
  monthsBack = 6
): MonthlyFinancials[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const today = new Date();
  const buckets: MonthlyFinancials[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABEL.format(d),
      revenue: 0,
      cogs: 0,
      expenses: 0,
    });
  }
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  for (const order of orders) {
    if (!order.delivery_date || order.unit_price == null) continue;
    const bucket = bucketByKey.get(order.delivery_date.slice(0, 7));
    if (!bucket) continue;
    bucket.revenue += convertAmount(order.unit_price * order.quantity, order.unit_price_currency, to, rates);
    const product = order.product_id ? productById.get(order.product_id) : undefined;
    if (product?.cogs != null) {
      const cogsCurrency = (product.cogs_currency as CurrencyCode | null) ?? "CHF";
      bucket.cogs += convertAmount(product.cogs * order.quantity, cogsCurrency, to, rates);
    }
  }

  for (const expense of expenses) {
    const bucket = bucketByKey.get(expense.expense_date.slice(0, 7));
    if (!bucket) continue;
    bucket.expenses += convertAmount(expense.amount, expense.currency, to, rates);
  }

  return buckets;
}
