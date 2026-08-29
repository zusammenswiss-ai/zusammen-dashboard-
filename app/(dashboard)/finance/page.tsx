"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Package, Tag } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Order, Product } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatMoney } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/lib/company-settings";
import type { CurrencyCode } from "@/lib/supabase/types";
import { ORDER_STATUS_HU } from "@/lib/labels";

/**
 * The calculator reads straight from the Termékek katalógus (products
 * table) instead of its own separate finance_products rows — a product's
 * name/ár/COGS only ever gets entered once, on Termékek; this page just
 * asks for the one thing it uniquely owns, planned_units, and computes
 * bevétel/árrés from there. See supabase/schema.sql's comment on
 * products.planned_units for why it lives on that table.
 */
export default function FinancePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  // Beállítások → Pénznem preferencia — display only, see lib/currency.ts.
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  const supabase = getSupabaseClient();

  const loadProducts = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [productsRes, ordersRes, companySettingsRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: true }),
      supabase.from("orders").select("*"),
      supabase.from("company_settings").select("currency").maybeSingle(),
    ]);
    if (productsRes.error) setError(productsRes.error.message);
    else setProducts(productsRes.data ?? []);
    if (!ordersRes.error) setOrders(ordersRes.data ?? []);
    setCurrency(companySettingsRes.data?.currency ?? DEFAULT_CURRENCY);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadProducts();
  }, [supabase, loadProducts]);

  async function updateUnits(id: string, units: number) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, planned_units: units } : p)));
    if (!supabase) return;
    const { error: updateError } = await supabase.from("products").update({ planned_units: units }).eq("id", id);
    if (updateError) setError(updateError.message);
  }

  const totals = useMemo(() => {
    const revenue = products.reduce((sum, p) => sum + (p.sale_price ?? 0) * p.planned_units, 0);
    const cogsTotal = products.reduce((sum, p) => sum + (p.cogs ?? 0) * p.planned_units, 0);
    const margin = revenue - cogsTotal;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, cogsTotal, margin, marginPct };
  }, [products]);

  const orderRevenue = useMemo(() => {
    const priced = orders.filter((o) => o.unit_price != null);
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const o of priced) {
      const line = (o.unit_price ?? 0) * o.quantity;
      total += line;
      byStatus[o.status] = (byStatus[o.status] ?? 0) + line;
    }
    return { total, byStatus, pricedCount: priced.length, missingCount: orders.length - priced.length };
  }, [orders]);

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
        subtitle="Tervezési kalkulátor a Termékek katalógusból — a valós bevételt lásd lent, a Megrendelések alapján."
        action={
          <Link href="/products" className="btn btn-ghost">
            <Tag size={16} /> Termékek kezelése
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      {!loading && orders.length > 0 && (
        <div className="card mb-6 p-5">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-bronze" />
            <h2 className="font-serif text-lg text-forest">Tényleges bevétel — Megrendelésekből</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            A lenti kalkulátortól függetlenül, a Megrendelések fülön rögzített valós egységárak alapján.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Valós bevétel (árazott rendelésekből)" value={formatMoney(orderRevenue.total, currency)} />
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
              összegben. Add meg a Megrendelések fülön a pontosabb számokért.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="Még nincs termék"
          description="Adj hozzá egy terméket a Termékek fülön, hogy elkezdhesd számolni a bevételt és az árrést."
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Termék</th>
                  <th className="px-4 py-3 font-medium">Ár ({currency})</th>
                  <th className="px-4 py-3 font-medium">Önköltség</th>
                  <th className="px-4 py-3 font-medium">Tervezett darabszám</th>
                  <th className="px-4 py-3 font-medium">Bevétel</th>
                  <th className="px-4 py-3 font-medium">Árrés</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <FinanceRow
                    key={product.id}
                    product={product}
                    currency={currency}
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
                    <span className="text-xs font-normal text-muted">
                      ({totals.marginPct.toFixed(1)}%)
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Az ár és az önköltség a Termékek fülről érkezik — ott szerkeszthető. Itt csak a tervezett darabszámot
            add meg termékenként.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Teljes bevétel" value={formatMoney(totals.revenue, currency)} />
            <SummaryCard label="Teljes önköltség" value={formatMoney(totals.cogsTotal, currency)} />
            <SummaryCard
              label="Bruttó árrés"
              value={`${formatMoney(totals.margin, currency)} · ${totals.marginPct.toFixed(1)}%`}
            />
          </div>
        </>
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
  onUpdateUnits,
}: {
  product: Product;
  currency: CurrencyCode;
  onUpdateUnits: (units: number) => void;
}) {
  const salePrice = product.sale_price ?? 0;
  const cogs = product.cogs ?? 0;
  const revenue = salePrice * product.planned_units;
  const margin = (salePrice - cogs) * product.planned_units;
  const currencyMismatch = Boolean(product.cogs_currency && product.cogs_currency !== currency);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2">
        <Link href="/products" className="font-medium text-forest hover:text-bronze">
          {product.name}
        </Link>
        {product.edition && <p className="text-xs text-muted">{product.edition}</p>}
      </td>
      <td className="px-4 py-2 text-forest">{product.sale_price != null ? formatMoney(salePrice, currency) : "—"}</td>
      <td className="px-4 py-2 text-forest">
        {product.cogs != null ? (
          <>
            {formatMoney(cogs, (product.cogs_currency as CurrencyCode) ?? "CHF")}
            {currencyMismatch && <span className="ml-1 text-xs text-yellow-700">⚠</span>}
          </>
        ) : (
          "—"
        )}
      </td>
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
