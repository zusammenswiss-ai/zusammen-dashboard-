"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, X, Check, Repeat, Paperclip, Search, Download, ExternalLink } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  Expense,
  ExpenseType,
  ExpenseInsert,
  CurrencyCode,
  RecurrenceType,
  Product,
} from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import LockControls from "@/components/finance/LockControls";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES, RECURRENCE_TYPES, PAYMENT_METHODS, recurrenceFrequencyLabel } from "@/lib/labels";
import { monthlyEquivalent } from "@/lib/finance";
import { openFileLabel, isPreviewableInBrowser } from "@/lib/file-open";
import { toCSV, downloadCSV } from "@/lib/csv";
import { errorMessage } from "@/lib/errors";

const RECEIPT_BUCKET = "receipts";

type SupplierOption = { id: string; name: string };
type ProductOption = Pick<Product, "id" | "name" | "cogs" | "cogs_currency">;

function byDateDesc(a: Expense, b: Expense) {
  return b.expense_date.localeCompare(a.expense_date);
}

async function uploadReceipt(file: File): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Shared Fix/Változó költségek section — both tabs read/write the same
 * `expenses` table, filtered on `type`. Kattintásra szerkeszthetővé
 * válik a sor (inline edit, mint a Feladatoknál a founder eredeti
 * kérése szerint), mentés/mégse gombbal, nem külön modal.
 */
export default function ExpenseSection({
  title,
  type,
  expenses,
  suppliers,
  products,
  receiptSignedUrls,
  showFilters = false,
  onAdd,
  onUpdate,
  onDelete,
  onReceiptResolved,
}: {
  title: string;
  type: ExpenseType;
  expenses: Expense[];
  suppliers: SupplierOption[];
  products: ProductOption[];
  receiptSignedUrls: Map<string, string>;
  showFilters?: boolean;
  onAdd: (expense: Expense) => void;
  onUpdate: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onReceiptResolved: (storedUrl: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const productNameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

  const typed = useMemo(() => expenses.filter((e) => e.type === type), [expenses, type]);

  const filtered = useMemo(() => {
    return typed
      .filter((e) => (categoryFilter ? e.category === categoryFilter : true))
      .filter((e) => (fromDate ? e.expense_date >= fromDate : true))
      .filter((e) => (toDate ? e.expense_date <= toDate : true))
      .filter((e) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return e.description.toLowerCase().includes(q) || (e.notes ?? "").toLowerCase().includes(q);
      })
      .sort(byDateDesc);
  }, [typed, categoryFilter, fromDate, toDate, query]);

  const totalMonthly = useMemo(
    () => (type === "Fix költség" ? typed.reduce((sum, e) => sum + monthlyEquivalent(e), 0) : null),
    [typed, type]
  );

  function handleDelete(expense: Expense) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (editingId === expense.id) setEditingId(null);
    onDelete(expense.id);
    scheduleUndo(
      `"${expense.description}" törölve.`,
      async () => {
        const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
        if (error) console.error(error.message);
      },
      () => onAdd(expense)
    );
  }

  async function handleLock(expense: Expense) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("expenses")
      .update({ is_locked: true, locked_at: new Date().toISOString() })
      .eq("id", expense.id)
      .select()
      .single();
    if (error) throw new Error(errorMessage(error, "Nem sikerült lezárni a rögzítést."));
    if (data) onUpdate(data);
  }

  async function handleUnlock(expense: Expense, reason: string | null) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const nextHistory = [...expense.unlock_history, { unlocked_at: new Date().toISOString(), reason }];
    const { data, error } = await supabase
      .from("expenses")
      .update({ is_locked: false, unlock_history: nextHistory })
      .eq("id", expense.id)
      .select()
      .single();
    if (error) throw new Error(errorMessage(error, "Nem sikerült feloldani a zárolást."));
    if (data) onUpdate(data);
  }

  function exportCSV() {
    const headers = [
      "datum",
      "kategoria",
      "leiras",
      "osszeg",
      "penznem",
      "ismetlodo",
      "gyakorisag",
      "fizetesi_mod",
      "beszallito",
      "termek",
      "megjegyzes",
      "lezarva",
      "feloldva_valaha",
    ];
    const rows = filtered.map((e) => [
      e.expense_date,
      e.category,
      e.description,
      e.amount,
      e.currency,
      e.is_recurring ? "igen" : "nem",
      e.recurrence_type ?? "",
      e.payment_method ?? "",
      e.related_supplier_id ? supplierNameById.get(e.related_supplier_id) ?? "" : "",
      e.related_product_id ? productNameById.get(e.related_product_id) ?? "" : "",
      e.notes ?? "",
      e.is_locked ? "igen" : "nem",
      e.unlock_history.length > 0 ? "igen" : "nem",
    ]);
    downloadCSV(
      `${type === "Fix költség" ? "fix-koltsegek" : "valtozo-koltsegek"}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(headers, rows)
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-lg text-forest">
            {title} {typed.length > 0 && `(${typed.length})`}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {typed.length > 0 && (
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
            <Plus size={14} /> {type === "Fix költség" ? "Fix költség hozzáadása" : "Változó költség hozzáadása"}
          </button>
        </div>
      </div>

      {totalMonthly != null && typed.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          Összesen havi szinten: <span className="font-medium text-forest">{formatMoney(totalMonthly, typed[0]?.currency ?? "CHF")}</span>{" "}
          <span className="text-xs">(vegyes pénznemű tételeknél a saját pénznemükben összesítve — lásd Áttekintés az átváltott összegért)</span>
        </p>
      )}

      {showFilters && typed.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-8 !py-1.5 text-xs"
              placeholder="Keresés…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Kategória</label>
            <select className="select !py-1.5 text-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Összes</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Ettől</label>
            <input type="date" className="input !py-1.5 text-xs" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Eddig</label>
            <input type="date" className="input !py-1.5 text-xs" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      )}

      {showForm && (
        <ExpenseForm
          type={type}
          suppliers={suppliers}
          products={products}
          onCreated={(e) => {
            onAdd(e);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {typed.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={type === "Fix költség" ? "Még nincs rögzített fix költség" : "Még nincs rögzített változó költség"}
          description="Rögzítsd a tételeket, hogy a Költségvetés, a Cash Flow és a fedezeti pont valós legyen."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nincs találat" description="Próbálj más szűrőt." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((expense) =>
            editingId === expense.id ? (
              <ExpenseEditRow
                key={expense.id}
                expense={expense}
                suppliers={suppliers}
                products={products}
                receiptSignedUrls={receiptSignedUrls}
                onSaved={(e) => {
                  onUpdate(e);
                  setEditingId(null);
                  if (e.receipt_url) onReceiptResolved(e.receipt_url);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                supplierName={expense.related_supplier_id ? supplierNameById.get(expense.related_supplier_id) ?? null : null}
                productName={expense.related_product_id ? productNameById.get(expense.related_product_id) ?? null : null}
                receiptUrl={expense.receipt_url ? receiptSignedUrls.get(expense.receipt_url) ?? null : null}
                onEdit={() => {
                  setShowForm(false);
                  setEditingId(expense.id);
                }}
                onDelete={() => handleDelete(expense)}
                onLock={() => handleLock(expense)}
                onUnlock={(reason) => handleUnlock(expense, reason)}
              />
            )
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function ExpenseRow({
  expense,
  supplierName,
  productName,
  receiptUrl,
  onEdit,
  onDelete,
  onLock,
  onUnlock,
}: {
  expense: Expense;
  supplierName: string | null;
  productName: string | null;
  receiptUrl: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onLock: () => Promise<void>;
  onUnlock: (reason: string | null) => Promise<void>;
}) {
  const locked = expense.is_locked;
  return (
    <div
      onClick={locked ? undefined : onEdit}
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm ${
        locked ? "" : "cursor-pointer hover:border-bronze/40"
      }`}
    >
      <div className="min-w-0">
        <span className={`font-medium ${locked ? "text-muted" : "text-forest"}`}>{expense.description}</span>
        <span className={`ml-1.5 badge ${locked ? "bg-ivory-dim text-muted" : "bg-ivory-dim text-walnut"}`}>
          {expense.category}
        </span>
        {expense.is_recurring && expense.recurrence_type && (
          <span className="ml-1.5 badge bg-blue-100 text-blue-700">
            <Repeat size={10} className="mr-0.5 inline" />
            {recurrenceFrequencyLabel(expense.recurrence_type, 1)} · {formatMoney(monthlyEquivalent(expense) * 12, expense.currency)}/év
          </span>
        )}
        {supplierName && (
          <Link
            href="/suppliers"
            onClick={(e) => e.stopPropagation()}
            className="ml-1.5 badge bg-forest/10 text-forest hover:underline"
          >
            {supplierName}
          </Link>
        )}
        {productName && (
          <Link
            href="/products"
            onClick={(e) => e.stopPropagation()}
            className="ml-1.5 badge bg-forest/10 text-forest hover:underline"
          >
            {productName}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {receiptUrl && (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted/70 hover:text-forest"
            title={openFileLabel(expense.receipt_url)}
            aria-label="Nyugta megtekintése"
          >
            {isPreviewableInBrowser(expense.receipt_url) ? <ExternalLink size={13} /> : <Paperclip size={13} />}
          </a>
        )}
        <span className="text-xs text-muted">{formatDate(expense.expense_date)}</span>
        <span className={`font-medium ${locked ? "text-muted" : "text-forest"}`}>
          {formatMoney(expense.amount, expense.currency)}
        </span>
        {!locked && (
          <>
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
          </>
        )}
        <LockControls
          isLocked={locked}
          lockedAt={expense.locked_at}
          unlockHistory={expense.unlock_history}
          onLock={onLock}
          onUnlock={onUnlock}
        />
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  description: "",
  category: EXPENSE_CATEGORIES[0],
  amount: "",
  currency: "CHF" as CurrencyCode,
  expense_date: new Date().toISOString().slice(0, 10),
  is_recurring: false,
  recurrence_type: "Havi" as RecurrenceType,
  payment_method: "",
  notes: "",
  related_supplier_id: "",
  related_product_id: "",
};

function ExpenseForm({
  type,
  suppliers,
  products,
  onCreated,
  onCancel,
}: {
  type: ExpenseType;
  suppliers: SupplierOption[];
  products: ProductOption[];
  onCreated: (expense: Expense) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyProductCogs(productId: string) {
    const product = products.find((p) => p.id === productId);
    setForm((f) => ({
      ...f,
      related_product_id: productId,
      description: product ? `${product.name} gyártási költsége (COGS)` : f.description,
      amount: product?.cogs != null ? String(product.cogs) : f.amount,
      currency: (product?.cogs_currency as CurrencyCode | null) ?? f.currency,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const amount = Number(form.amount);
    if (!supabase || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Adj meg egy leírást és egy pozitív összeget.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const receiptUrl = file ? await uploadReceipt(file) : null;
      const payload: ExpenseInsert = {
        description: form.description.trim(),
        category: form.category,
        type,
        amount,
        currency: form.currency,
        expense_date: form.expense_date,
        is_recurring: form.is_recurring,
        recurrence_type: form.is_recurring ? form.recurrence_type : null,
        payment_method: form.payment_method.trim() || null,
        receipt_url: receiptUrl,
        notes: form.notes.trim() || null,
        related_supplier_id: form.related_supplier_id || null,
        related_product_id: form.related_product_id || null,
      };
      const { data, error: insertError } = await supabase.from("expenses").insert(payload).select().single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a költséget."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      {products.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Termék COGS beszúrása (opcionális)</label>
          <select className="select" value={form.related_product_id} onChange={(e) => applyProductCogs(e.target.value)}>
            <option value="">— Nincs, kézzel töltöm ki —</option>
            {products
              .filter((p) => p.cogs != null)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(p.cogs as number, (p.cogs_currency as CurrencyCode | null) ?? "CHF")}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Leírás *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="pl. Claude AI előfizetés"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
          <input
            type="date"
            className="input"
            value={form.expense_date}
            onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
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
            placeholder="pl. 25"
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
          <label className="mb-1 block text-xs font-medium text-muted">Fizetési mód</label>
          <input
            className="input"
            list="payment-methods"
            value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
            placeholder="pl. Bankkártya"
          />
          <datalist id="payment-methods">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Beszállító (opcionális)</label>
          <select
            className="select"
            value={form.related_supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, related_supplier_id: e.target.value }))}
          >
            <option value="">— Nincs —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="mb-1 flex items-center gap-1.5 text-sm text-forest">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
            />
            Ismétlődő
          </label>
        </div>
        {form.is_recurring && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Gyakoriság</label>
            <select
              className="select"
              value={form.recurrence_type}
              onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value as RecurrenceType }))}
            >
              {RECURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nyugta/számla (opcionális)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea
          className="textarea min-h-16"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Költség mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function ExpenseEditRow({
  expense,
  suppliers,
  products,
  receiptSignedUrls,
  onSaved,
  onCancel,
}: {
  expense: Expense;
  suppliers: SupplierOption[];
  products: ProductOption[];
  receiptSignedUrls: Map<string, string>;
  onSaved: (expense: Expense) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    description: expense.description,
    category: expense.category,
    amount: String(expense.amount),
    currency: expense.currency,
    expense_date: expense.expense_date,
    is_recurring: expense.is_recurring,
    recurrence_type: expense.recurrence_type ?? ("Havi" as RecurrenceType),
    payment_method: expense.payment_method ?? "",
    notes: expense.notes ?? "",
    related_supplier_id: expense.related_supplier_id ?? "",
    related_product_id: expense.related_product_id ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existingReceiptUrl = expense.receipt_url ? receiptSignedUrls.get(expense.receipt_url) ?? null : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const amount = Number(form.amount);
    if (!supabase || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Adj meg egy leírást és egy pozitív összeget.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const receiptUrl = file ? await uploadReceipt(file) : expense.receipt_url;
      const payload = {
        description: form.description.trim(),
        category: form.category,
        amount,
        currency: form.currency,
        expense_date: form.expense_date,
        is_recurring: form.is_recurring,
        recurrence_type: form.is_recurring ? form.recurrence_type : null,
        payment_method: form.payment_method.trim() || null,
        receipt_url: receiptUrl,
        notes: form.notes.trim() || null,
        related_supplier_id: form.related_supplier_id || null,
        related_product_id: form.related_product_id || null,
      };
      const { data, error: updateError } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", expense.id)
        .select()
        .single();
      if (updateError) throw updateError;
      if (data) onSaved(data);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a módosítást."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Leírás *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
          <input
            type="date"
            className="input"
            value={form.expense_date}
            onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
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
          <label className="mb-1 block text-xs font-medium text-muted">Fizetési mód</label>
          <input
            className="input"
            list="payment-methods-edit"
            value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
          />
          <datalist id="payment-methods-edit">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
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
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Beszállító (opcionális)</label>
          <select
            className="select"
            value={form.related_supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, related_supplier_id: e.target.value }))}
          >
            <option value="">— Nincs —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="mb-1 flex items-center gap-1.5 text-sm text-forest">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
            />
            Ismétlődő
          </label>
        </div>
        {form.is_recurring && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Gyakoriság</label>
            <select
              className="select"
              value={form.recurrence_type}
              onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value as RecurrenceType }))}
            >
              {RECURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nyugta/számla</label>
          {existingReceiptUrl && !file && (
            <a
              href={existingReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-1 flex items-center gap-1 text-xs text-bronze hover:underline"
            >
              <Paperclip size={12} /> Jelenlegi fájl megtekintése
            </a>
          )}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea
          className="textarea min-h-16"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
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
