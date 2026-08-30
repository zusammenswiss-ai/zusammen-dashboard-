"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, Package, CalendarDays, Hash, Mail, Search, Download } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CurrencyCode, Order, OrderStatus } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import EmailComposeModal from "@/components/EmailComposeModal";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatDate } from "@/lib/format";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { ORDER_STATUS_HU } from "@/lib/labels";
import { toCSV, downloadCSV } from "@/lib/csv";

const EXPORT_HEADERS = [
  "customer_name",
  "customer_email",
  "product",
  "quantity",
  "unit_price",
  "unit_price_currency",
  "delivery_date",
  "status",
  "notes",
];

function exportOrdersCSV(orders: Order[]) {
  const rows = orders.map((o) => [
    o.customer_name,
    o.customer_email,
    o.product,
    o.quantity,
    o.unit_price,
    o.unit_price_currency,
    o.delivery_date,
    ORDER_STATUS_HU[o.status],
    o.notes,
  ]);
  downloadCSV("megrendelesek.csv", toCSV(EXPORT_HEADERS, rows));
}

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
  customer_email: "",
  product: "",
  product_id: "",
  quantity: "1",
  unit_price: "",
  unit_price_currency: "CHF" as CurrencyCode,
  delivery_date: "",
  status: "New" as OrderStatus,
};

// Only what the "Kapcsolt termék" picker needs — not the full Product
// shape, so a partial select doesn't have to pretend it fetched columns
// it didn't ask for.
type ProductOption = { id: string; name: string };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "All">("All");
  const [query, setQuery] = useState("");
  const [composeFor, setComposeFor] = useState<Order | null>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadOrders = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [ordersRes, productsRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").order("name", { ascending: true }),
    ]);
    if (ordersRes.error) setError(ordersRes.error.message);
    else setOrders(ordersRes.data ?? []);
    if (!productsRes.error) {
      const rows: ProductOption[] = productsRes.data ?? [];
      setProducts(rows);
    }
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
    const unitPrice = Number(form.unit_price);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || null,
        product: form.product.trim() || null,
        product_id: form.product_id || null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit_price: form.unit_price.trim() && Number.isFinite(unitPrice) ? unitPrice : null,
        unit_price_currency: form.unit_price_currency,
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

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesFilter = filter === "All" || o.status === filter;
      const matchesQuery =
        !q ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.product ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [orders, filter, query]);

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
          <div className="flex flex-wrap gap-2">
            {orders.length > 0 && (
              <button className="btn btn-ghost" onClick={() => exportOrdersCSV(orders)}>
                <Download size={16} /> Exportálás CSV-be
              </button>
            )}
            <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
              <Plus size={16} /> Megrendelés hozzáadása
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form
          onSubmit={addOrder}
          className="card mb-6 grid animate-fade-in grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 lg:items-end"
        >
          <div>
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
            <label className="mb-1 block text-xs font-medium text-muted">Vevő email</label>
            <input
              type="email"
              className="input"
              value={form.customer_email}
              onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
              placeholder="vevo@example.com"
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
            <label className="mb-1 block text-xs font-medium text-muted">Kapcsolt termék (Termékek katalógusból)</label>
            <select
              className="select"
              value={form.product_id}
              onChange={(e) => {
                const productId = e.target.value;
                const linked = products.find((p) => p.id === productId);
                setForm((f) => ({
                  ...f,
                  product_id: productId,
                  // Auto-fills the free-text label if it's still empty —
                  // never overwrites something already typed.
                  product: !f.product.trim() && linked ? linked.name : f.product,
                }));
              }}
            >
              <option value="">— nincs (egyedi tétel) —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Kell a valós árréshez a Pénzügyeken — nem kötelező.</p>
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
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Egységár</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.unit_price}
                onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                placeholder="pl. 24.90"
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs font-medium text-muted">Pénznem</label>
              <select
                className="select"
                value={form.unit_price_currency}
                onChange={(e) => setForm((f) => ({ ...f, unit_price_currency: e.target.value as CurrencyCode }))}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="flex gap-2 lg:col-span-3">
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
        <div className="relative mb-4 max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Megrendelések keresése…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
              products={products}
              expanded={expanded === order.id}
              onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
              onUpdate={(patch) => updateOrder(order.id, patch)}
              onDelete={() => deleteOrder(order.id)}
              onEmail={() => setComposeFor(order)}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}

      {composeFor && (
        <EmailComposeModal
          title={`Email küldése — ${composeFor.customer_name}`}
          defaultTo={composeFor.customer_email ?? ""}
          defaultSubject="Rendelés visszaigazolása — Zusammen"
          defaultBody={`Kedves ${composeFor.customer_name}!\n\nKöszönjük a megrendelést${
            composeFor.product ? ` (${composeFor.product}${composeFor.quantity ? `, ${composeFor.quantity} db` : ""})` : ""
          }.\n\n`}
          onClose={() => setComposeFor(null)}
          onSent={({ to }) => updateOrder(composeFor.id, { customer_email: to })}
        />
      )}
    </>
  );
}

function OrderRow({
  order,
  products,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onEmail,
}: {
  order: Order;
  products: ProductOption[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Order>) => void;
  onDelete: () => void;
  onEmail: () => void;
}) {
  const [notes, setNotes] = useState(order.notes ?? "");
  const [customerEmail, setCustomerEmail] = useState(order.customer_email ?? "");
  const [unitPrice, setUnitPrice] = useState(order.unit_price != null ? String(order.unit_price) : "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomerEmail(order.customer_email ?? "");
  }, [order.customer_email]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnitPrice(order.unit_price != null ? String(order.unit_price) : "");
  }, [order.unit_price]);

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
              {order.unit_price != null && (
                <span className="font-medium text-forest">
                  {formatMoney(order.unit_price * order.quantity, order.unit_price_currency)}
                </span>
              )}
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

        <button onClick={onEmail} className="btn btn-ghost shrink-0 !px-2" aria-label="Email küldése">
          <Mail size={15} />
        </button>

        <button onClick={onDelete} className="btn btn-danger shrink-0 !px-2" aria-label="Megrendelés törlése">
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-border bg-ivory-dim/40 p-4 animate-fade-in sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Vevő email</label>
            <input
              type="email"
              className="input"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              onBlur={() =>
                customerEmail !== (order.customer_email ?? "") &&
                onUpdate({ customer_email: customerEmail || null })
              }
              placeholder="vevo@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kapcsolt termék (Termékek katalógusból)</label>
            <select
              className="select"
              value={order.product_id ?? ""}
              onChange={(e) => onUpdate({ product_id: e.target.value || null })}
            >
              <option value="">— nincs (egyedi tétel) —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Egységár</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                onBlur={() => {
                  const parsed = Number(unitPrice);
                  const next = unitPrice.trim() && Number.isFinite(parsed) ? parsed : null;
                  if (next !== order.unit_price) onUpdate({ unit_price: next });
                }}
                placeholder="pl. 24.90"
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs font-medium text-muted">Pénznem</label>
              <select
                className="select"
                value={order.unit_price_currency}
                onChange={(e) => onUpdate({ unit_price_currency: e.target.value as CurrencyCode })}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
            <textarea
              className="textarea min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (order.notes ?? "") && onUpdate({ notes })}
              placeholder="Csomagolás, számlázás, egyeztetés…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
