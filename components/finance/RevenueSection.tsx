"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, X, Check, Download, FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Revenue, RevenueInsert, CurrencyCode, Product } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { toCSV, downloadCSV } from "@/lib/csv";

type ProductOption = Pick<Product, "id" | "name">;

function byDateDesc(a: Revenue, b: Revenue) {
  return b.revenue_date.localeCompare(a.revenue_date);
}

/**
 * Bevételek — explicitly logged revenue rows, independent of the
 * Megrendelések-based "Tényleges bevétel" and the Termékek-based
 * tervezési kalkulátor on Áttekintés (both stay as they were). A row
 * with an invoice_id was auto-created by a kiállított Számlázás
 * QR-számla — its státusz/leírás stays editable here too (e.g. marking
 * it Kifizetve once the payment arrives doesn't require going back to
 * Számlázás), but the invoice link itself isn't removable from here.
 */
export default function RevenueSection({
  title,
  revenue,
  products,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string;
  revenue: Revenue[];
  products: ProductOption[];
  onAdd: (r: Revenue) => void;
  onUpdate: (r: Revenue) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const productNameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const sorted = useMemo(() => [...revenue].sort(byDateDesc), [revenue]);

  function handleDelete(r: Revenue) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (editingId === r.id) setEditingId(null);
    onDelete(r.id);
    scheduleUndo(
      `"${r.source}" törölve.`,
      async () => {
        const { error } = await supabase.from("revenue").delete().eq("id", r.id);
        if (error) console.error(error.message);
      },
      () => onAdd(r)
    );
  }

  function exportCSV() {
    const headers = ["datum", "forras", "osszeg", "penznem", "termek", "statusz", "megjegyzes"];
    const rows = sorted.map((r) => [
      r.revenue_date,
      r.source,
      r.amount,
      r.currency,
      r.related_product_id ? productNameById.get(r.related_product_id) ?? "" : "",
      r.status ?? "",
      r.notes ?? "",
    ]);
    downloadCSV(`bevetelek-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-forest">
          {title} {revenue.length > 0 && `(${revenue.length})`}
        </h2>
        <div className="flex flex-wrap gap-2">
          {revenue.length > 0 && (
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={exportCSV}>
              <Download size={14} /> Exportálás CSV-be
            </button>
          )}
          <button
            className="btn btn-bronze !px-3 !py-1.5 text-xs"
            onClick={() => {
              setEditingId(null);
              setShowForm((v) => !v);
            }}
          >
            <Plus size={14} /> Új bevétel rögzítése
          </button>
        </div>
      </div>

      {showForm && (
        <RevenueForm
          products={products}
          onCreated={(r) => {
            onAdd(r);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {revenue.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Még nincs rögzített bevétel"
          description="Rögzítsd a beérkezett bevételeket, hogy az Áttekintés, a Cash Flow és az ÁFA/MWST küszöb-mérő valós legyen."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((r) =>
            editingId === r.id ? (
              <RevenueEditRow
                key={r.id}
                revenue={r}
                products={products}
                onSaved={(saved) => {
                  onUpdate(saved);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <RevenueRow
                key={r.id}
                revenue={r}
                productName={r.related_product_id ? productNameById.get(r.related_product_id) ?? null : null}
                onEdit={() => {
                  setShowForm(false);
                  setEditingId(r.id);
                }}
                onDelete={() => handleDelete(r)}
              />
            )
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function RevenueRow({
  revenue,
  productName,
  onEdit,
  onDelete,
}: {
  revenue: Revenue;
  productName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-bronze/40"
    >
      <div className="min-w-0">
        <span className="font-medium text-forest">{revenue.source}</span>
        {productName && (
          <Link
            href="/products"
            onClick={(e) => e.stopPropagation()}
            className="ml-1.5 badge bg-forest/10 text-forest hover:underline"
          >
            {productName}
          </Link>
        )}
        {revenue.status && (
          <span
            className={`ml-1.5 badge ${revenue.status === "Kifizetve" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
          >
            {revenue.status}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-muted">{formatDate(revenue.revenue_date)}</span>
        <span className="font-medium text-forest">{formatMoney(revenue.amount, revenue.currency)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-muted/70 hover:text-forest"
          title="Szerkesztés"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted/70 hover:text-red-600"
          title="Törlés"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  source: "",
  amount: "",
  currency: "CHF" as CurrencyCode,
  revenue_date: new Date().toISOString().slice(0, 10),
  related_product_id: "",
  notes: "",
};

function RevenueForm({
  products,
  onCreated,
  onCancel,
}: {
  products: ProductOption[];
  onCreated: (r: Revenue) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const amount = Number(form.amount);
    if (!supabase || !form.source.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Adj meg egy forrást és egy pozitív összeget.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: RevenueInsert = {
      source: form.source.trim(),
      amount,
      currency: form.currency,
      revenue_date: form.revenue_date,
      related_product_id: form.related_product_id || null,
      notes: form.notes.trim() || null,
    };
    const { data, error: insertError } = await supabase.from("revenue").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Forrás *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            placeholder="pl. Connection Cards eladás"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
          <input
            type="date"
            className="input"
            value={form.revenue_date}
            onChange={(e) => setForm((f) => ({ ...f, revenue_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Összeg *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className="input"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
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
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Termék (opcionális)</label>
          <select
            className="select"
            value={form.related_product_id}
            onChange={(e) => setForm((f) => ({ ...f, related_product_id: e.target.value }))}
          >
            <option value="">— Nincs —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea className="textarea min-h-16" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Bevétel mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function RevenueEditRow({
  revenue,
  products,
  onSaved,
  onCancel,
}: {
  revenue: Revenue;
  products: ProductOption[];
  onSaved: (r: Revenue) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    source: revenue.source,
    amount: String(revenue.amount),
    currency: revenue.currency,
    revenue_date: revenue.revenue_date,
    related_product_id: revenue.related_product_id ?? "",
    notes: revenue.notes ?? "",
    status: revenue.status ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const amount = Number(form.amount);
    if (!supabase || !form.source.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Adj meg egy forrást és egy pozitív összeget.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("revenue")
      .update({
        source: form.source.trim(),
        amount,
        currency: form.currency,
        revenue_date: form.revenue_date,
        related_product_id: form.related_product_id || null,
        notes: form.notes.trim() || null,
        status: form.status || null,
      })
      .eq("id", revenue.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Forrás *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
          <input
            type="date"
            className="input"
            value={form.revenue_date}
            onChange={(e) => setForm((f) => ({ ...f, revenue_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Összeg *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className="input"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
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
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Termék (opcionális)</label>
          <select
            className="select"
            value={form.related_product_id}
            onChange={(e) => setForm((f) => ({ ...f, related_product_id: e.target.value }))}
          >
            <option value="">— Nincs —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {revenue.invoice_id && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Számla státusza</label>
            <select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="Kiállítva">Kiállítva</option>
              <option value="Kifizetve">Kifizetve</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea className="textarea min-h-16" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Mégse
        </button>
      </div>
    </form>
  );
}
