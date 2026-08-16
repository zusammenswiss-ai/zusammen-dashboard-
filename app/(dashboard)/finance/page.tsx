"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Calculator, Package } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { FinanceProduct, Order } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatCHF } from "@/lib/format";
import { ORDER_STATUS_HU } from "@/lib/labels";

function byProductRecency(a: FinanceProduct, b: FinanceProduct) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function FinancePage() {
  const [products, setProducts] = useState<FinanceProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadProducts = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [productsRes, ordersRes] = await Promise.all([
      supabase.from("finance_products").select("*").order("created_at", { ascending: true }),
      supabase.from("orders").select("*"),
    ]);
    if (productsRes.error) setError(productsRes.error.message);
    else setProducts(productsRes.data ?? []);
    if (!ordersRes.error) setOrders(ordersRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadProducts();
  }, [supabase, loadProducts]);

  async function addRow() {
    if (!supabase) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("finance_products")
      .insert({ name: "Új termék", price: 0, cogs: 0, units: 0 })
      .select()
      .single();
    setAdding(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setProducts((prev) => [...prev, data]);
  }

  async function updateRow(id: string, patch: Partial<FinanceProduct>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (!supabase) return;
    const { error } = await supabase.from("finance_products").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  function deleteRow(id: string) {
    if (!supabase) return;
    const removed = products.find((p) => p.id === id);
    if (!removed) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    scheduleUndo(
      `"${removed.name}" törölve.`,
      async () => {
        const { error } = await supabase.from("finance_products").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setProducts((prev) => [...prev, removed].sort(byProductRecency))
    );
  }

  const totals = useMemo(() => {
    const revenue = products.reduce((sum, p) => sum + p.price * p.units, 0);
    const cogsTotal = products.reduce((sum, p) => sum + p.cogs * p.units, 0);
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
        subtitle="Tervezési kalkulátor a teljes termékpalettádhoz — a valós bevételt lásd lent, a Megrendelések alapján."
        action={
          <button className="btn btn-bronze" onClick={addRow} disabled={adding}>
            <Plus size={16} /> Termék hozzáadása
          </button>
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
            <SummaryCard label="Valós bevétel (árazott rendelésekből)" value={formatCHF(orderRevenue.total)} />
            {(Object.keys(orderRevenue.byStatus) as (keyof typeof orderRevenue.byStatus)[])
              .sort()
              .map((status) => (
                <SummaryCard
                  key={status}
                  label={ORDER_STATUS_HU[status as keyof typeof ORDER_STATUS_HU] ?? status}
                  value={formatCHF(orderRevenue.byStatus[status])}
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
          description="Adj hozzá egy terméksort, hogy elkezdhesd számolni a bevételt és az árrést."
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Termék</th>
                  <th className="px-4 py-3 font-medium">Ár (CHF)</th>
                  <th className="px-4 py-3 font-medium">Önköltség (CHF)</th>
                  <th className="px-4 py-3 font-medium">Darabszám</th>
                  <th className="px-4 py-3 font-medium">Bevétel</th>
                  <th className="px-4 py-3 font-medium">Árrés</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <FinanceRow
                    key={product.id}
                    product={product}
                    onUpdate={(patch) => updateRow(product.id, patch)}
                    onDelete={() => deleteRow(product.id)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-forest/15 bg-ivory-dim/50 font-medium text-forest">
                  <td className="px-4 py-3" colSpan={4}>
                    Összesen
                  </td>
                  <td className="px-4 py-3">{formatCHF(totals.revenue)}</td>
                  <td className="px-4 py-3">
                    {formatCHF(totals.margin)}{" "}
                    <span className="text-xs font-normal text-muted">
                      ({totals.marginPct.toFixed(1)}%)
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Teljes bevétel" value={formatCHF(totals.revenue)} />
            <SummaryCard label="Teljes önköltség" value={formatCHF(totals.cogsTotal)} />
            <SummaryCard
              label="Bruttó árrés"
              value={`${formatCHF(totals.margin)} · ${totals.marginPct.toFixed(1)}%`}
            />
          </div>
        </>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
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
  onUpdate,
  onDelete,
}: {
  product: FinanceProduct;
  onUpdate: (patch: Partial<FinanceProduct>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(product.name);
  const revenue = product.price * product.units;
  const margin = (product.price - product.cogs) * product.units;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== product.name && onUpdate({ name })}
        />
      </td>
      <td className="px-4 py-2">
        <NumberCell value={product.price} onCommit={(v) => onUpdate({ price: v })} />
      </td>
      <td className="px-4 py-2">
        <NumberCell value={product.cogs} onCommit={(v) => onUpdate({ cogs: v })} />
      </td>
      <td className="px-4 py-2">
        <NumberCell value={product.units} onCommit={(v) => onUpdate({ units: v })} step="1" />
      </td>
      <td className="px-4 py-2 font-medium text-forest">{formatCHF(revenue)}</td>
      <td className={`px-4 py-2 font-medium ${margin < 0 ? "text-red-600" : "text-forest"}`}>
        {formatCHF(margin)}
      </td>
      <td className="px-4 py-2 text-right">
        <button onClick={onDelete} className="text-muted hover:text-red-600" aria-label="Sor törlése">
          <Trash2 size={15} />
        </button>
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
