import { describe, expect, it } from "vitest";
import { breakEvenUnits, buildMonthlyTrend, fixedMonthlyCost, monthlyEquivalent } from "@/lib/finance";
import type { ExchangeRates } from "@/lib/exchange-rates";
import type { Expense, Order, Product } from "@/lib/supabase/types";

// Minimal fixtures — only the fields each function under test actually
// reads are meaningful; the rest are filler to satisfy the full row type.
function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "e1",
    name: "Tesztkiadás",
    category: "Egyéb",
    amount: 100,
    currency: "CHF",
    expense_date: "2026-01-15",
    is_recurring: false,
    recurrence_type: null,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

function order(overrides: Partial<Order>): Order {
  return {
    id: "o1",
    customer_name: "Teszt Vevő",
    customer_email: null,
    product: "Connection Cards",
    product_id: null,
    quantity: 1,
    unit_price: 30,
    unit_price_currency: "CHF",
    delivery_date: "2026-01-15",
    status: "Done",
    notes: null,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

function product(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    name: "Connection Cards",
    edition: null,
    status: "Élő",
    card_asset_id: null,
    supplier_id: null,
    cogs: 10,
    cogs_currency: "CHF",
    sale_price: 30,
    sale_price_currency: "CHF",
    description: null,
    production_note: null,
    image_url: null,
    planned_units: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("monthlyEquivalent", () => {
  it("is 0 for a non-recurring expense", () => {
    expect(monthlyEquivalent(expense({ is_recurring: false, amount: 1200 }))).toBe(0);
  });

  it("passes a monthly expense through unchanged", () => {
    expect(monthlyEquivalent(expense({ is_recurring: true, recurrence_type: "Havi", amount: 100 }))).toBe(100);
  });

  it("divides a quarterly expense by 3", () => {
    expect(monthlyEquivalent(expense({ is_recurring: true, recurrence_type: "Negyedéves", amount: 300 }))).toBe(100);
  });

  it("divides a yearly expense by 12", () => {
    expect(monthlyEquivalent(expense({ is_recurring: true, recurrence_type: "Éves", amount: 1200 }))).toBe(100);
  });

  it("scales a weekly expense up by ~4.345 weeks/month", () => {
    expect(monthlyEquivalent(expense({ is_recurring: true, recurrence_type: "Heti", amount: 10 }))).toBeCloseTo(43.45, 5);
  });
});

describe("fixedMonthlyCost", () => {
  it("sums only recurring expenses, converted into the target currency", () => {
    const rates: ExchangeRates = { CHF: 1, USD: 1.1, EUR: 0.95 };
    const expenses = [
      expense({ is_recurring: true, recurrence_type: "Havi", amount: 100, currency: "CHF" }),
      expense({ is_recurring: false, amount: 9999, currency: "CHF" }), // excluded
      expense({ is_recurring: true, recurrence_type: "Havi", amount: 110, currency: "USD" }), // -> 100 CHF
    ];
    expect(fixedMonthlyCost(expenses, "CHF", rates)).toBeCloseTo(200, 5);
  });
});

describe("breakEvenUnits", () => {
  it("divides fixed cost by margin per unit", () => {
    expect(breakEvenUnits(1000, 20)).toBe(50);
  });

  it("is null when margin is zero or negative (can never break even)", () => {
    expect(breakEvenUnits(1000, 0)).toBeNull();
    expect(breakEvenUnits(1000, -5)).toBeNull();
  });
});

describe("buildMonthlyTrend", () => {
  it("returns `monthsBack` buckets, oldest first, current month last", () => {
    const buckets = buildMonthlyTrend([], [], [], "CHF", null, 3);
    expect(buckets).toHaveLength(3);
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(buckets[buckets.length - 1].key).toBe(currentKey);
  });

  it("only counts an order's revenue/COGS in the bucket matching its delivery_date", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-10`;
    const orders = [order({ delivery_date: thisMonth, unit_price: 30, quantity: 2, product_id: "p1" })];
    const products = [product({ id: "p1", cogs: 10, cogs_currency: "CHF" })];
    const buckets = buildMonthlyTrend(orders, products, [], "CHF", null, 1);
    expect(buckets[0].revenue).toBe(60); // 30 * 2
    expect(buckets[0].cogs).toBe(20); // 10 * 2
  });

  it("ignores an order with no delivery_date or no unit_price", () => {
    const orders = [
      order({ delivery_date: null, unit_price: 30 }),
      order({ delivery_date: "2026-01-10", unit_price: null }),
    ];
    const buckets = buildMonthlyTrend(orders, [], [], "CHF", null, 1);
    expect(buckets[0].revenue).toBe(0);
  });

  it("counts an expense's amount in the bucket matching its expense_date", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-05`;
    const expenses = [expense({ expense_date: thisMonth, amount: 250, currency: "CHF" })];
    const buckets = buildMonthlyTrend([], [], expenses, "CHF", null, 1);
    expect(buckets[0].expenses).toBe(250);
  });
});
