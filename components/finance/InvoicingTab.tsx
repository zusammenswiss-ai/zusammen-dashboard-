"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, FileDown, FileText, Check, Settings2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CompanySettings, CurrencyCode, Invoice, InvoiceItem, Revenue } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_STYLES } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";

function nextInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const count = invoices.filter((inv) => inv.invoice_number.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

/**
 * Számlázás — svájci QR-számla. A "Számlázási adatok" kártya (IBAN +
 * kiállítói cím) itt lakik, nem Beállításokon, mert kizárólag ez a fül
 * használja — lásd app/api/finance/invoice-pdf/route.ts, ami a
 * swissqrbill csomaggal generálja a tényleges PDF-et ezekből az
 * adatokból. Egy kiállított (nem Piszkozat) számla önmaga hozza létre a
 * Bevételek egy sorát (Kiállítva/Kifizetve státusszal, invoice_id-vel) —
 * a founder onnan is szerkesztheti tovább, ha kell.
 */
export default function InvoicingTab({
  invoices,
  settings,
  onSettingsSaved,
  onInvoiceCreated,
  onInvoiceUpdated,
  onInvoiceDeleted,
  onRevenueCreated,
}: {
  invoices: Invoice[];
  settings: CompanySettings | null;
  onSettingsSaved: (patch: Partial<CompanySettings>) => void;
  onInvoiceCreated: (invoice: Invoice) => void;
  onInvoiceUpdated: (invoice: Invoice) => void;
  onInvoiceDeleted: (id: string) => void;
  onRevenueCreated: (revenue: Revenue) => void;
}) {
  const [showSettings, setShowSettings] = useState(!settings?.iban);
  const [showForm, setShowForm] = useState(false);
  const billingComplete = Boolean(settings?.iban && settings.billing_street && settings.billing_zip && settings.billing_city);
  const sorted = useMemo(() => [...invoices].sort((a, b) => b.invoice_number.localeCompare(a.invoice_number)), [invoices]);

  async function markStatus(invoice: Invoice, status: "Kiállítva" | "Kifizetve") {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("invoices").update({ status }).eq("id", invoice.id).select().single();
    if (error || !data) return;
    onInvoiceUpdated(data);

    if (status === "Kiállítva") {
      const { data: totals } = await supabase.from("invoice_items").select("quantity, unit_price").eq("invoice_id", invoice.id);
      const amount = (totals ?? []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
      const { data: revenue } = await supabase
        .from("revenue")
        .insert({
          revenue_date: invoice.issue_date,
          amount,
          currency: invoice.currency,
          source: `Számla ${invoice.invoice_number} — ${invoice.customer_name}`,
          status: "Kiállítva",
          invoice_id: invoice.id,
        })
        .select()
        .single();
      if (revenue) onRevenueCreated(revenue);
    }
  }

  function deleteInvoice(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    onInvoiceDeleted(id);
    void supabase.from("invoices").delete().eq("id", id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <button type="button" onClick={() => setShowSettings((v) => !v)} className="flex w-full items-center justify-between text-left">
          <span className="flex items-center gap-2 font-serif text-lg text-forest">
            <Settings2 size={16} className="text-bronze" /> Számlázási adatok
          </span>
          {!billingComplete && <span className="badge bg-yellow-100 text-yellow-800">Hiányos</span>}
        </button>
        {showSettings && (
          <BillingSettingsForm settings={settings} onSaved={onSettingsSaved} onCancel={() => setShowSettings(false)} />
        )}
        {!billingComplete && !showSettings && (
          <p className="mt-2 text-xs text-muted">
            Az IBAN és a kiállítói cím nélkül nem generálható QR-számla PDF — kattints a fenti sorra a kitöltéshez.
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-forest">Számlák {invoices.length > 0 && `(${invoices.length})`}</h2>
          <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)} disabled={!billingComplete}>
            <Plus size={14} /> Új számla
          </button>
        </div>

        {showForm && (
          <InvoiceForm
            invoices={invoices}
            onCreated={(invoice) => {
              onInvoiceCreated(invoice);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="Még nincs kiállított számla" description="Hozd létre az elsőt fent." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-forest">{invoice.invoice_number}</span>
                  <span className="ml-1.5 text-muted">{invoice.customer_name}</span>
                  <span className={`ml-1.5 badge ${INVOICE_STATUS_STYLES[invoice.status]}`}>{invoice.status}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted">{formatDate(invoice.issue_date)}</span>
                  {invoice.status === "Piszkozat" && (
                    <button onClick={() => markStatus(invoice, "Kiállítva")} className="text-xs font-medium text-bronze hover:underline">
                      Kiállítás
                    </button>
                  )}
                  {invoice.status === "Kiállítva" && (
                    <button onClick={() => markStatus(invoice, "Kifizetve")} className="text-xs font-medium text-bronze hover:underline">
                      <Check size={12} className="mr-0.5 inline" /> Kifizetve
                    </button>
                  )}
                  <a
                    href={`/api/finance/invoice-pdf?id=${invoice.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted/70 hover:text-forest"
                    title="PDF letöltése"
                  >
                    <FileDown size={14} />
                  </a>
                  <button onClick={() => deleteInvoice(invoice.id)} className="text-muted/70 hover:text-red-600" title="Törlés">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BillingSettingsForm({
  settings,
  onSaved,
  onCancel,
}: {
  settings: CompanySettings | null;
  onSaved: (patch: Partial<CompanySettings>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    iban: settings?.iban ?? "",
    billing_street: settings?.billing_street ?? "",
    billing_zip: settings?.billing_zip ?? "",
    billing_city: settings?.billing_city ?? "",
    billing_country: settings?.billing_country ?? "CH",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      if (settings) {
        const { error: updateError } = await supabase.from("company_settings").update(form).eq("id", settings.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("company_settings").insert(form);
        if (insertError) throw insertError;
      }
      onSaved(form);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a számlázási adatokat."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
      {error && (
        <p className="lg:col-span-4 text-xs text-red-600">{error}</p>
      )}
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs font-medium text-muted">IBAN *</label>
        <input
          className="input"
          required
          value={form.iban}
          onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
          placeholder="CH44 3199 9123 0008 8901 2"
        />
      </div>
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs font-medium text-muted">Utca, házszám *</label>
        <input
          className="input"
          required
          value={form.billing_street}
          onChange={(e) => setForm((f) => ({ ...f, billing_street: e.target.value }))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Irányítószám *</label>
        <input
          className="input"
          required
          value={form.billing_zip}
          onChange={(e) => setForm((f) => ({ ...f, billing_zip: e.target.value }))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Város *</label>
        <input
          className="input"
          required
          value={form.billing_city}
          onChange={(e) => setForm((f) => ({ ...f, billing_city: e.target.value }))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Ország</label>
        <input
          className="input"
          value={form.billing_country}
          maxLength={2}
          onChange={(e) => setForm((f) => ({ ...f, billing_country: e.target.value.toUpperCase() }))}
        />
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Mentés"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn btn-ghost">
          Mégse
        </button>
      </div>
    </form>
  );
}

type ItemDraft = { description: string; quantity: string; unit_price: string };

function InvoiceForm({
  invoices,
  onCreated,
  onCancel,
}: {
  invoices: Invoice[];
  onCreated: (invoice: Invoice) => void;
  onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("CHF");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (!supabase || !customerName.trim() || validItems.length === 0) {
      setError("Adj meg egy vevőnevet és legalább egy tételt.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: nextInvoiceNumber(invoices),
          customer_name: customerName.trim(),
          customer_address: customerAddress.trim() || null,
          issue_date: issueDate,
          due_date: dueDate || null,
          currency,
          notes: notes.trim() || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (!invoice) throw new Error("Nem sikerült létrehozni a számlát.");

      const itemRows: Omit<InvoiceItem, "id" | "created_at">[] = validItems.map((it, position) => ({
        invoice_id: invoice.id,
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price) || 0,
        position,
      }));
      const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
      if (itemsError) throw itemsError;

      onCreated(invoice);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült létrehozni a számlát."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Vevő neve *</label>
          <input className="input" required autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Vevő címe</label>
          <input className="input" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kiállítás dátuma</label>
          <input type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Fizetési határidő</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Pénznem</label>
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
            {CURRENCY_OPTIONS.filter((c) => c === "CHF" || c === "EUR").map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted">A svájci QR-számla csak CHF/EUR-ban.</p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Tételek</label>
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Megnevezés"
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="1"
                className="input w-20"
                placeholder="Menny."
                value={item.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="input w-28"
                placeholder="Egységár"
                value={item.unit_price}
                onChange={(e) => updateItem(i, { unit_price: e.target.value })}
              />
              <span className="w-24 shrink-0 text-right text-sm text-forest">
                {formatMoney((Number(item.quantity) || 0) * (Number(item.unit_price) || 0), currency)}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted/70 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "" }])}
          className="btn btn-ghost mt-2 !py-1 text-xs"
        >
          <Plus size={12} /> Tétel hozzáadása
        </button>
        <p className="mt-2 text-sm font-medium text-forest">Végösszeg: {formatMoney(total, currency)}</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
        <textarea className="textarea min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Számla létrehozása (Piszkozat)"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}
