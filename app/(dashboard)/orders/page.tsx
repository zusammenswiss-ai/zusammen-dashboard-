"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, Package, CalendarDays, Hash } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatDate } from "@/lib/format";
import { ORDER_STATUS_HU } from "@/lib/labels";

function byOrderRecency(a: Order, b: Order) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const STATUSES: OrderStatus[] = ["New", "Processing", "Shipped", "Done"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  New: "bg-ivory-dim text-walnut",
  Processing: "bg-bronze/15 text-walnut",
  Shipped: "bg-forest-light/15 text-forest",
  Done: "bg-forest/10 text-forest",
};

const EMPTY_FORM = {
  customer_name: "",
  product: "",
  quantity: "1",
  delivery_date: "",
  status: "New" as OrderStatus,
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "All">("All");

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadOrders = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setOrders(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadOrders();
  }, [supabase, loadOrders]);

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.customer_name.trim()) return;
    setSaving(true);
    const quantity = Number(form.quantity);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: form.customer_name.trim(),
        product: form.product.trim() || null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        delivery_date: form.delivery_date || null,
        status: form.status,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setOrders((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function updateOrder(id: string, patch: Partial<Order>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    if (!supabase) return;
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  function deleteOrder(id: string) {
    if (!supabase) return;
    const removed = orders.find((o) => o.id === id);
    if (!removed) return;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    scheduleUndo(
      `"${removed.customer_name}" megrendelése törölve.`,
      async () => {
        const { error } = await supabase.from("orders").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setOrders((prev) => [...prev, removed].sort(byOrderRecency))
    );
  }

  const visibleOrders = useMemo(
    () => (filter === "All" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Megrendelések" />
        <EmptyState icon={Package} title="Csatlakoztasd a Supabase-t a megrendelések kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Megrendelések"
        subtitle="Vevői megrendelések nyomon követése a beérkezéstől a kiszállításig."
        action={
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Megrendelés hozzáadása
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form
          onSubmit={addOrder}
          className="card mb-6 grid animate-fade-in grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        >
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Vevő *</label>
            <input
              className="input"
              required
              autoFocus
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              placeholder="pl. Müller Boutique, Zürich"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Termék</label>
            <input
              className="input"
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
              placeholder="pl. Indulócsomag"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Mennyiség</label>
            <input
              type="number"
              min="1"
              step="1"
              className="input"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Szállítási határidő</label>
            <input
              type="date"
              className="input"
              value={form.delivery_date}
              onChange={(e) => setForm((f) => ({ ...f, delivery_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
            <select
              className="select"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as OrderStatus }))}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_HU[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 lg:col-span-5">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Megrendelés mentése"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {!loading && orders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(["All", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`badge cursor-pointer border ${
                filter === s ? "border-forest bg-forest text-ivory" : "border-border bg-white text-muted"
              }`}
            >
              {s === "All" ? "Összes" : ORDER_STATUS_HU[s]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Még nincs megrendelés"
          description="Add hozzá az első vevői megrendelést, hogy nyomon tudd követni a kiszállításig."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleOrders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              expanded={expanded === order.id}
              onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
              onUpdate={(patch) => updateOrder(order.id, patch)}
              onDelete={() => deleteOrder(order.id)}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}

function OrderRow({
  order,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Order>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(order.notes ?? "");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
        <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left">
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-forest">{order.customer_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              {order.product && <span>{order.product}</span>}
              <span className="flex items-center gap-1">
                <Hash size={11} /> {order.quantity}
              </span>
              {order.delivery_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays size={11} /> {formatDate(order.delivery_date)}
                </span>
              )}
            </div>
          </div>
        </button>

        <select
          className={`select w-auto shrink-0 text-xs ${STATUS_STYLES[order.status]}`}
          value={order.status}
          onChange={(e) => onUpdate({ status: e.target.value as OrderStatus })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_HU[s]}
            </option>
          ))}
        </select>

        <button onClick={onDelete} className="btn btn-danger shrink-0 !px-2" aria-label="Megrendelés törlése">
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-ivory-dim/40 p-4 animate-fade-in">
          <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
          <textarea
            className="textarea min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (order.notes ?? "") && onUpdate({ notes })}
            placeholder="Csomagolás, számlázás, egyeztetés…"
          />
        </div>
      )}
    </div>
  );
}
