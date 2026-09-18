"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Package, Tag } from "lucide-react";
import type { CurrencyCode, Expense, Order, Product, Revenue } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import BreakEvenCalculator from "@/components/BreakEvenCalculator";
import FinanceTrendChart from "@/components/FinanceTrendChart";
import { formatMoney } from "@/lib/currency";
import { ORDER_STATUS_HU } from "@/lib/labels";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";
import { buildMonthlyTrend, fixedMonthlyCost } from "@/lib/finance";

const REALIZED_STATUSES = new Set(["Shipped", "Done"]);

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-xl text-forest">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Áttekintés — a Pénzügyek fül belépési pontja. A tetején az új,
 * idei-évi (YTD) Fix/Változó/Bevétel/Eredmény összesítő sáv, alatta a
 * korábbi, önmagában megálló tartalom változatlanul: a Megrendelések-
 * alapú tényleges bevétel, a Havi trend grafikon, a fedezeti pont
 * kalkulátor, és a Termékek-alapú tervezési kalkulátor.
 */
export default function OverviewTab({
  products,
  orders,
  expenses,
  revenue,
  currency,
  rates,
  onUpdateUnits,
}: {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  revenue: Revenue[];
  currency: CurrencyCode;
  rates: ExchangeRates | null;
  onUpdateUnits: (id: string, units: number) => void;
}) {
  const year = new Date().getFullYear();

  const ytdSummary = useMemo(() => {
    const fixed = expenses
      .filter((e) => e.type === "Fix költség" && e.expense_date.startsWith(String(year)))
      .reduce((sum, e) => sum + convertAmount(e.amount, e.currency, currency, rates), 0);
    const variable = expenses
      .filter((e) => e.type === "Változó költség" && e.expense_date.startsWith(String(year)))
      .reduce((sum, e) => sum + convertAmount(e.amount, e.currency, currency, rates), 0);
    const totalRevenue = revenue
      .filter((r) => r.revenue_date.startsWith(String(year)))
      .reduce((sum, r) => sum + convertAmount(r.amount, r.currency, currency, rates), 0);
    const result = totalRevenue - fixed - variable;
    const marginPct = totalRevenue > 0 ? (result / totalRevenue) * 100 : 0;
    return { fixed, variable, totalRevenue, result, marginPct };
  }, [expenses, revenue, currency, rates, year]);

  const totals = useMemo(() => {
    const rev = products.reduce(
      (sum, p) => sum + convertAmount(p.sale_price ?? 0, p.sale_price_currency, currency, rates) * p.planned_units,
      0
    );
    const cogsTotal = products.reduce(
      (sum, p) =>
        sum +
        convertAmount(p.cogs ?? 0, (p.cogs_currency as CurrencyCode | null) ?? "CHF", currency, rates) * p.planned_units,
      0
    );
    const margin = rev - cogsTotal;
    const marginPct = rev > 0 ? (margin / rev) * 100 : 0;
    return { revenue: rev, cogsTotal, margin, marginPct };
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
  const monthlyTrend = useMemo(() => buildMonthlyTrend(orders, products, expenses, currency, rates), [orders, products, expenses, currency, rates]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 font-serif text-lg text-forest">{year}. év eddig</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Összes fix költség" value={formatMoney(ytdSummary.fixed, currency)} />
          <SummaryCard label="Összes változó költség" value={formatMoney(ytdSummary.variable, currency)} />
          <SummaryCard label="Összes bevétel" value={formatMoney(ytdSummary.totalRevenue, currency)} />
          <SummaryCard
            label="Eredmény"
            value={formatMoney(ytdSummary.result, currency)}
            hint={`Árrés: ${ytdSummary.marginPct.toFixed(1)}%`}
          />
        </div>
      </div>

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
              {orderRevenue.missingCount} megrendelésnél nincs megadva egységár — ezek nem szerepelnek a fenti
              összegben.
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg text-forest">Tervezési kalkulátor</h2>
            <Link href="/products" className="btn btn-ghost !py-1.5 text-xs">
              <Tag size={14} /> Termékek kezelése
            </Link>
          </div>
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
                    onUpdateUnits={(units) => onUpdateUnits(product.id, units)}
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
            <SummaryCard label="Bruttó árrés" value={`${formatMoney(totals.margin, currency)} · ${totals.marginPct.toFixed(1)}%`} />
          </div>
        </div>
      )}
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
      <td className={`px-4 py-2 font-medium ${margin < 0 ? "text-red-600" : "text-forest"}`}>{formatMoney(margin, currency)}</td>
    </tr>
  );
}

function NumberCell({ value, onCommit, step = "0.01" }: { value: number; onCommit: (value: number) => void; step?: string }) {
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
