"use client";

import { useState } from "react";
import { Receipt, Plus, Trash2, Repeat } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Expense, CurrencyCode, RecurrenceType } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES, RECURRENCE_TYPES, recurrenceFrequencyLabel } from "@/lib/labels";

function byDateDesc(a: Expense, b: Expense) {
  return b.expense_date.localeCompare(a.expense_date);
}

/**
 * Kiadások (operating costs) — independent of a product's COGS. Feeds
 * both the havi trend grafikon (every dated row) and the fedezeti pont
 * kalkulátor (only is_recurring rows, normalized to a monthly figure —
 * see lib/finance.ts) on the Pénzügyek page, which owns this table's
 * state and passes it down here.
 */
export default function ExpensesSection({
  expenses,
  onAdd,
  onDelete,
}: {
  expenses: Expense[];
  onAdd: (expense: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();
  const sorted = [...expenses].sort(byDateDesc);

  function handleDelete(expense: Expense) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    onDelete(expense.id);
    scheduleUndo(
      `"${expense.name}" törölve.`,
      async () => {
        const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
        if (error) console.error(error.message);
      },
      () => onAdd(expense)
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">Kiadások {expenses.length > 0 && `(${expenses.length})`}</h2>
        </div>
        <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Költség hozzáadása
        </button>
      </div>

      {showForm && (
        <ExpenseForm
          onCreated={(e) => {
            onAdd(e);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Még nincs rögzített kiadás"
          description="Rögzítsd a működési költségeket (hosting, könyvelés, marketing, csomagolás…), hogy a fedezeti pont és a havi trend valós legyen."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((expense) => (
            <div key={expense.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-forest">{expense.name}</span>
                <span className="ml-1.5 badge bg-ivory-dim text-walnut">{expense.category}</span>
                {expense.is_recurring && expense.recurrence_type && (
                  <span className="ml-1.5 badge bg-blue-100 text-blue-700">
                    <Repeat size={10} className="mr-0.5 inline" />
                    {recurrenceFrequencyLabel(expense.recurrence_type, 1)}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted">{formatDate(expense.expense_date)}</span>
                <span className="font-medium text-forest">{formatMoney(expense.amount, expense.currency)}</span>
                <button onClick={() => handleDelete(expense)} className="text-muted/70 hover:text-red-600" title="Törlés">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  category: EXPENSE_CATEGORIES[0],
  amount: "",
  currency: "CHF" as CurrencyCode,
  expense_date: new Date().toISOString().slice(0, 10),
  is_recurring: false,
  recurrence_type: "Havi" as RecurrenceType,
};

function ExpenseForm({ onCreated, onCancel }: { onCreated: (expense: Expense) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const amount = Number(form.amount);
    if (!supabase || !form.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Adj meg egy nevet és egy pozitív összeget.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("expenses")
      .insert({
        name: form.name.trim(),
        category: form.category,
        amount,
        currency: form.currency,
        expense_date: form.expense_date,
        is_recurring: form.is_recurring,
        recurrence_type: form.is_recurring ? form.recurrence_type : null,
      })
      .select()
      .single();
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
          <label className="mb-1 block text-xs font-medium text-muted">Megnevezés *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="pl. Supabase Pro előfizetés"
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
      </div>
      {form.is_recurring && (
        <p className="text-xs text-muted">
          Az ismétlődő kiadások adják a fedezeti pont kalkulátor havi fix költségét — nincs automatikus
          feladat-generálás hozzá, csak a jelenleg élő, ismétlődőnek jelölt tételeket veszi figyelembe.
        </p>
      )}
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
