"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Download, Package, Tag } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CurrencyCode, Expense, Order, Product } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import ExpensesSection from "@/components/ExpensesSection";
import BreakEvenCalculator from "@/components/BreakEvenCalculator";
import FinanceTrendChart from "@/components/FinanceTrendChart";
import { formatMoney } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/lib/company-settings";
import { ORDER_STATUS_HU } from "@/lib/labels";
import { convertAmount, fetchExchangeRates, type ExchangeRates } from "@/lib/exchange-rates";
import { buildMonthlyTrend, fixedMonthlyCost } from "@/lib/finance";
import { toCSV, downloadCSV } from "@/lib/csv";

const REALIZED_STATUSES = new Set(["Shipped", "Done"]);

function exportFinanceCSV(products: Product[], currency: CurrencyCode, rates: ExchangeRates | null) {
  const headers = ["name", `ar_${currency}`, `onkoltseg_${currency}`, "tervezett_darabszam", `bevetel_${currency}`, `arres_${currency}`];
  const rows = products.map((p) => {
    const price = convertAmount(p.sale_price ?? 0, p.sale_price_currency, currency, rates);
    const cogs = convertAmount(p.cogs ?? 0, (p.cogs_currency as CurrencyCode | null) ?? "CHF", currency, rates);
    return [p.name, price, cogs, p.planned_units, price * p.planned_units, (price - cogs) * p.planned_units];
  });
  downloadCSV(`penzugyek-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}

/**
 * Reads the Termékek katalógus (products table) instead of its own
 * separate finance_products rows — a product's name/ár/COGS only ever
 * gets entered once, on Termékek; this page just asks for the one thing
 * it uniquely owns, planned_units, and computes bevétel/árrés from
 * there. See supabase/schema.sql's comment on products.planned_units.
 *
 * Every mixed-currency sum on this page (a USD-quoted COGS against a
 * CHF sale price, say) goes through lib/exchange-rates.ts's
 * convertAmount with live rates fetched once on load — see
 * fetchExchangeRates below. If that fetch fails, every conversion
 * degrades to "no conversion" (the pre-existing behavior) rather than
 * blocking the page; ratesError surfaces that so numbers involving a
 * currency mismatch aren't silently wrong.
 */
export default function FinancePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  // Beállítások → Pénznem preferencia — every number on this page is
  // converted into this currency, not just relabeled.
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const loadAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [productsRes, ordersRes, expensesRes, companySettingsRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: true }),
      supabase.from("orders").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("company_settings").select("currency").maybeSingle(),
    ]);
    if (productsRes.error) setError(productsRes.error.message);
    else setProducts(productsRes.data ?? []);
    if (!ordersRes.error) setOrders(ordersRes.data ?? []);
    if (!expensesRes.error) setExpenses(expensesRes.data ?? []);
    setCurrency(companySettingsRes.data?.currency ?? DEFAULT_CURRENCY);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadAll();
  }, [supabase, loadAll]);

  useEffect(() => {
    fetchExchangeRates().then((result) => {
      if (result.ok) setRates(result.rates);
      else setRatesError(result.error);
    });
  }, []);

  async function updateUnits(id: string, units: number) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, planned_units: units } : p)));
    if (!supabase) return;
    const { error: updateError } = await supabase.from("products").update({ planned_units: units }).eq("id", id);
    if (updateError) setError(updateError.message);
  }

  function addExpense(expense: Expense) {
    setExpenses((prev) => [expense, ...prev]);
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const totals = useMemo(() => {
    const revenue = products.reduce(
      (sum, p) => sum + convertAmount(p.sale_price ?? 0, p.sale_price_currency, currency, rates) * p.planned_units,
      0
    );
    const cogsTotal = products.reduce(
      (sum, p) =>
        sum +
        convertAmount(p.cogs ?? 0, (p.cogs_currency as CurrencyCode | null) ?? "CHF", currency, rates) *
          p.planned_units,
      0
    );
    const margin = revenue - cogsTotal;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, cogsTotal, margin, marginPct };
  }, [products, currency, rates]);

  const orderRevenue = useMemo(() => {
    const priced = orders.filter((o) => o.unit_price != null);
    const byStatus: Record<string, number> = {};
    let realized = 0;
    let expected = 0;
    let realizedMargin = 0;
    let ordersWithoutProduct = 0;
    for (const o of priced) {
      const line = convertAmount((o.unit_price ?? 0) * o.quantity, o.unit_price_currency, currency, rates);
      byStatus[o.status] = (byStatus[o.status] ?? 0) + line;
      if (REALIZED_STATUSES.has(o.status)) {
        realized += line;
        const product = o.product_id ? products.find((p) => p.id === o.product_id) : undefined;
        if (product?.cogs != null) {
          const cogsLine = convertAmount(
            product.cogs * o.quantity,
            (product.cogs_currency as CurrencyCode | null) ?? "CHF",
            currency,
            rates
          );
          realizedMargin += line - cogsLine;
        } else {
          ordersWithoutProduct += 1;
        }
      } else {
        expected += line;
      }
    }
    return {
      byStatus,
      realized,
      expected,
      realizedMargin,
      ordersWithoutProduct,
      pricedCount: priced.length,
      missingCount: orders.length - priced.length,
    };
  }, [orders, products, currency, rates]);

  const fixedMonthly = useMemo(() => fixedMonthlyCost(expenses, currency, rates), [expenses, currency, rates]);

  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(orders, products, expenses, currency, rates),
    [orders, products, expenses, currency, rates]
  );

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Pénzügyek" />
        <EmptyState icon={Calculator} title="Csatlakoztasd a Supabase-t a kalkulátor használatához" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pénzügyek"
        subtitle="Tervezés, valós bevétel, fedezeti pont és havi trend — egy helyen."
        action={
          <div className="flex flex-wrap gap-2">
            {products.length > 0 && (
              <button className="btn btn-ghost" onClick={() => exportFinanceCSV(products, currency, rates)}>
                <Download size={16} /> Exportálás CSV-be
              </button>
            )}
            <Link href="/products" className="btn btn-ghost">
              <Tag size={16} /> Termékek kezelése
            </Link>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}
      {ratesError && (
        <p className="mb-4 text-xs text-yellow-700">
          ⚠ Nem sikerült lekérni az élő árfolyamokat ({ratesError}) — az eltérő pénznemű tételek emiatt
          átváltás nélkül, a saját számukkal szerepelnek az összesítésekben.
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-6">
          {orders.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-bronze" />
                <h2 className="font-serif text-lg text-forest">Tényleges bevétel — Megrendelésekből</h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                A lenti tervezési kalkulátortól függetlenül, a Megrendelések fülön rögzített valós egységárak
                alapján. <strong>Realizált</strong> = Kiszállítva/Teljesítve állapotú, <strong>Várható</strong> =
                Új/Feldolgozás alatt.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SummaryCard label="Realizált bevétel" value={formatMoney(orderRevenue.realized, currency)} />
                <SummaryCard label="Várható bevétel (pipeline)" value={formatMoney(orderRevenue.expected, currency)} />
                <SummaryCard label="Realizált árrés" value={formatMoney(orderRevenue.realizedMargin, currency)} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
                {(Object.keys(orderRevenue.byStatus) as (keyof typeof orderRevenue.byStatus)[])
                  .sort()
                  .map((status) => (
                    <SummaryCard
                      key={status}
                      label={ORDER_STATUS_HU[status as keyof typeof ORDER_STATUS_HU] ?? status}
                      value={formatMoney(orderRevenue.byStatus[status], currency)}
                    />
                  ))}
              </div>

              {orderRevenue.missingCount > 0 && (
                <p className="mt-3 text-xs text-muted">
                  {orderRevenue.missingCount} megrendelésnél nincs megadva egységár — ezek nem szerepelnek a
                  fenti összegben.
                </p>
              )}
              {orderRevenue.ordersWithoutProduct > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {orderRevenue.ordersWithoutProduct} realizált megrendelésnél nincs kapcsolt termék — ezeknél a
                  bevétel benne van a fenti számban, az árrés nem (nincs önköltség-adat). Kösd össze a
                  Megrendeléseken a &quot;Kapcsolt termék&quot; mezővel a pontosabb árréshez.
                </p>
              )}
            </div>
          )}

          <FinanceTrendChart months={monthlyTrend} currency={currency} />

          <BreakEvenCalculator products={products} fixedMonthlyCost={fixedMonthly} currency={currency} rates={rates} />

          {products.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title="Még nincs termék"
              description="Adj hozzá egy terméket a Termékek fülön, hogy elkezdhesd számolni a bevételt és az árrést."
            />
          ) : (
            <div className="card p-5">
              <h2 className="font-serif text-lg text-forest">Tervezési kalkulátor</h2>
              <p className="mt-1 text-sm text-muted">
                Az ár és az önköltség a Termékek fülről érkezik, a saját pénznemükben — itt csak a tervezett
                darabszámot add meg termékenként. A Bevétel/Árrés oszlopok, és az alábbi összesítés, mindig{" "}
                {currency}-ra átváltva.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">Termék</th>
                      <th className="px-4 py-3 font-medium">Ár</th>
                      <th className="px-4 py-3 font-medium">Önköltség</th>
                      <th className="px-4 py-3 font-medium">Tervezett darabszám</th>
                      <th className="px-4 py-3 font-medium">Bevétel ({currency})</th>
                      <th className="px-4 py-3 font-medium">Árrés ({currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <FinanceRow
                        key={product.id}
                        product={product}
                        currency={currency}
                        rates={rates}
                        onUpdateUnits={(units) => updateUnits(product.id, units)}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-forest/15 bg-ivory-dim/50 font-medium text-forest">
                      <td className="px-4 py-3" colSpan={4}>
                        Összesen
                      </td>
                      <td className="px-4 py-3">{formatMoney(totals.revenue, currency)}</td>
                      <td className="px-4 py-3">
                        {formatMoney(totals.margin, currency)}{" "}
                        <span className="text-xs font-normal text-muted">({totals.marginPct.toFixed(1)}%)</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SummaryCard label="Teljes bevétel" value={formatMoney(totals.revenue, currency)} />
                <SummaryCard label="Teljes önköltség" value={formatMoney(totals.cogsTotal, currency)} />
                <SummaryCard
                  label="Bruttó árrés"
                  value={`${formatMoney(totals.margin, currency)} · ${totals.marginPct.toFixed(1)}%`}
                />
              </div>
            </div>
          )}

          <ExpensesSection expenses={expenses} onAdd={addExpense} onDelete={removeExpense} />
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-xl text-forest">{value}</p>
    </div>
  );
}

function FinanceRow({
  product,
  currency,
  rates,
  onUpdateUnits,
}: {
  product: Product;
  currency: CurrencyCode;
  rates: ExchangeRates | null;
  onUpdateUnits: (units: number) => void;
}) {
  const cogsCurrency = (product.cogs_currency as CurrencyCode | null) ?? "CHF";
  const convertedPrice = convertAmount(product.sale_price ?? 0, product.sale_price_currency, currency, rates);
  const convertedCogs = convertAmount(product.cogs ?? 0, cogsCurrency, currency, rates);
  const revenue = convertedPrice * product.planned_units;
  const margin = (convertedPrice - convertedCogs) * product.planned_units;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2">
        <Link href="/products" className="font-medium text-forest hover:text-bronze">
          {product.name}
        </Link>
        {product.edition && <p className="text-xs text-muted">{product.edition}</p>}
      </td>
      <td className="px-4 py-2 text-forest">
        {product.sale_price != null ? formatMoney(product.sale_price, product.sale_price_currency) : "—"}
      </td>
      <td className="px-4 py-2 text-forest">{product.cogs != null ? formatMoney(product.cogs, cogsCurrency) : "—"}</td>
      <td className="px-4 py-2">
        <NumberCell value={product.planned_units} onCommit={onUpdateUnits} step="1" />
      </td>
      <td className="px-4 py-2 font-medium text-forest">{formatMoney(revenue, currency)}</td>
      <td className={`px-4 py-2 font-medium ${margin < 0 ? "text-red-600" : "text-forest"}`}>
        {formatMoney(margin, currency)}
      </td>
    </tr>
  );
}

function NumberCell({
  value,
  onCommit,
  step = "0.01",
}: {
  value: number;
  onCommit: (value: number) => void;
  step?: string;
}) {
  const [local, setLocal] = useState(String(value));

  return (
    <input
      type="number"
      step={step}
      min="0"
      className="input w-28"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = Number(local);
        const safe = Number.isFinite(parsed) ? parsed : 0;
        setLocal(String(safe));
        if (safe !== value) onCommit(safe);
      }}
    />
  );
}
