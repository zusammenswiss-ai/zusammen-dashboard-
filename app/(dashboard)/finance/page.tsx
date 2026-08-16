"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Calculator } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { FinanceProduct } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatCHF } from "@/lib/format";

export default function FinancePage() {
  const [products, setProducts] = useState<FinanceProduct[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const supabase = getSupabaseClient();

  const loadProducts = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("finance_products")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setProducts(data ?? []);
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

  async function deleteRow(id: string) {
    if (!supabase) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("finance_products").delete().eq("id", id);
    if (error) setError(error.message);
  }

  const totals = useMemo(() => {
    const revenue = products.reduce((sum, p) => sum + p.price * p.units, 0);
    const cogsTotal = products.reduce((sum, p) => sum + p.cogs * p.units, 0);
    const margin = revenue - cogsTotal;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, cogsTotal, margin, marginPct };
  }, [products]);

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
        subtitle="Gyors bevétel- és árréskalkulátor a teljes termékpalettádhoz."
        action={
          <button className="btn btn-bronze" onClick={addRow} disabled={adding}>
            <Plus size={16} /> Termék hozzáadása
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

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
