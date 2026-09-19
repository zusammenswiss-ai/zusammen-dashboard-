"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Trash2, Pencil, X, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ServiceAccount, ServiceAccountInsert, CurrencyCode } from "@/lib/supabase/types";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { daysUntil } from "@/lib/gold-card";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import CollapsibleSection from "@/components/CollapsibleSection";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { errorMessage } from "@/lib/errors";

const RENEWAL_WARNING_DAYS = 30;

function isRenewalSoon(renewalDate: string | null): boolean {
  if (!renewalDate) return false;
  const days = daysUntil(new Date(renewalDate), new Date());
  return days >= 0 && days <= RENEWAL_WARNING_DAYS;
}

function byNameAsc(a: ServiceAccount, b: ServiceAccount) {
  return a.service_name.localeCompare(b.service_name);
}

/**
 * Fiókok & Szolgáltatások — metadata-only overview of third-party
 * services (which email a service is registered under, what it's for,
 * when it renews). Deliberately NOT a credentials store: no password
 * field exists here or anywhere in this component, not even encrypted —
 * `password_manager_note` is a fixed string every row carries, shown as
 * a badge, never a form field.
 */
export default function ServiceAccountsSection() {
  const supabase = getSupabaseClient();
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("service_accounts").select("*");
    if (loadError) setError(errorMessage(loadError, "Nem sikerült betölteni a szolgáltatásokat."));
    setAccounts(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  const sorted = useMemo(() => [...accounts].sort(byNameAsc), [accounts]);

  function handleDelete(account: ServiceAccount) {
    if (!supabase) return;
    if (editingId === account.id) setEditingId(null);
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    scheduleUndo(
      `"${account.service_name}" törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("service_accounts").delete().eq("id", account.id);
        if (deleteError) console.error(deleteError.message);
      },
      () => setAccounts((prev) => [...prev, account])
    );
  }

  if (loading) return <Spinner />;

  return (
    <div className="card p-5 sm:p-6">
      <CollapsibleSection
        title={
          <h2 className="flex items-center gap-2 font-serif text-lg text-forest">
            <KeyRound size={18} className="text-bronze" /> Fiókok &amp; Szolgáltatások
          </h2>
        }
        right={accounts.length > 0 && <span className="badge bg-ivory-dim text-walnut">{accounts.length}</span>}
        actions={
          <button
            type="button"
            className="btn btn-bronze !px-3 !py-1.5 text-xs"
            onClick={() => {
              setEditingId(null);
              setShowForm((v) => !v);
            }}
          >
            <Plus size={14} /> Új szolgáltatás hozzáadása
          </button>
        }
        storageKey="zusammen-collapsed-settings-service-accounts"
        defaultOpen={false}
        headerClassName="mb-4"
      >
      <p className="mb-4 text-xs text-muted">
        Kizárólag áttekintés — melyik szolgáltatás melyik email-címmel van regisztrálva, mire használjuk, mikor
        újul meg. Jelszó vagy bármilyen hitelesítő adat nincs itt tárolva, azok a Bitwarden jelszókezelőben vannak.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <ServiceAccountForm
          onCreated={(a) => {
            setAccounts((prev) => [...prev, a]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Még nincs rögzített szolgáltatás"
          description="Add hozzá a domain, email, hosting és egyéb fiókokat, hogy áttekintésben lásd, mi hol fut és mikor újul meg."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((a) =>
            editingId === a.id ? (
              <ServiceAccountEditRow
                key={a.id}
                account={a}
                onSaved={(saved) => {
                  setAccounts((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ServiceAccountRow
                key={a.id}
                account={a}
                onEdit={() => {
                  setShowForm(false);
                  setEditingId(a.id);
                }}
                onDelete={() => handleDelete(a)}
              />
            )
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
      </CollapsibleSection>
    </div>
  );
}

function ServiceAccountRow({
  account,
  onEdit,
  onDelete,
}: {
  account: ServiceAccount;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const renewalSoon = isRenewalSoon(account.renewal_date);
  return (
    <div
      onClick={onEdit}
      className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-bronze/40"
    >
      <div className="min-w-0">
        <span className="font-medium text-forest">{account.service_name}</span>
        {account.account_email && <span className="ml-1.5 text-xs text-muted">{account.account_email}</span>}
        {account.purpose && <p className="mt-0.5 text-xs text-muted">{account.purpose}</p>}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="badge bg-forest/10 text-forest">
            <ShieldCheck size={11} /> {account.password_manager_note}
          </span>
          {renewalSoon && (
            <span className="badge bg-amber-100 text-amber-800">
              <AlertTriangle size={11} /> Hamarosan megújítandó
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {account.renewal_date && <span className="text-xs text-muted">Megújítás: {formatDate(account.renewal_date)}</span>}
        {account.renewal_cost != null && (
          <span className="font-medium text-forest">{formatMoney(account.renewal_cost, account.renewal_currency ?? "CHF")}</span>
        )}
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
  service_name: "",
  account_email: "",
  purpose: "",
  renewal_date: "",
  renewal_cost: "",
  renewal_currency: "CHF" as CurrencyCode,
  notes: "",
};

function ServiceAccountForm({
  onCreated,
  onCancel,
}: {
  onCreated: (a: ServiceAccount) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.service_name.trim()) {
      setError("Adj meg egy szolgáltatás-nevet.");
      return;
    }
    const cost = form.renewal_cost ? Number(form.renewal_cost) : null;
    if (form.renewal_cost && !Number.isFinite(cost)) {
      setError("A megújítás díja érvénytelen szám.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: ServiceAccountInsert = {
      service_name: form.service_name.trim(),
      account_email: form.account_email.trim() || null,
      purpose: form.purpose.trim() || null,
      renewal_date: form.renewal_date || null,
      renewal_cost: cost,
      renewal_currency: cost != null ? form.renewal_currency : null,
      notes: form.notes.trim() || null,
    };
    const { data, error: insertError } = await supabase.from("service_accounts").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a szolgáltatást."));
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Szolgáltatás neve *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.service_name}
            onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
            placeholder="pl. Vercel"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Fiók email-címe</label>
          <input
            type="email"
            className="input"
            value={form.account_email}
            onChange={(e) => setForm((f) => ({ ...f, account_email: e.target.value }))}
            placeholder="pl. zusammen.swiss@gmail.com"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Cél</label>
          <input
            className="input"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            placeholder="pl. Hosting, Dashboard + landing oldal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Megújítás dátuma</label>
          <input
            type="date"
            className="input"
            value={form.renewal_date}
            onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Megújítás díja</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.renewal_cost}
            onChange={(e) => setForm((f) => ({ ...f, renewal_cost: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Pénznem</label>
          <select
            className="select"
            value={form.renewal_currency}
            onChange={(e) => setForm((f) => ({ ...f, renewal_currency: e.target.value as CurrencyCode }))}
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
          className="textarea min-h-16"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="pl. 2FA aktív, Ingyenes csomag"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Szolgáltatás mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function ServiceAccountEditRow({
  account,
  onSaved,
  onCancel,
}: {
  account: ServiceAccount;
  onSaved: (a: ServiceAccount) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    service_name: account.service_name,
    account_email: account.account_email ?? "",
    purpose: account.purpose ?? "",
    renewal_date: account.renewal_date ?? "",
    renewal_cost: account.renewal_cost != null ? String(account.renewal_cost) : "",
    renewal_currency: account.renewal_currency ?? ("CHF" as CurrencyCode),
    notes: account.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.service_name.trim()) {
      setError("Adj meg egy szolgáltatás-nevet.");
      return;
    }
    const cost = form.renewal_cost ? Number(form.renewal_cost) : null;
    if (form.renewal_cost && !Number.isFinite(cost)) {
      setError("A megújítás díja érvénytelen szám.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("service_accounts")
      .update({
        service_name: form.service_name.trim(),
        account_email: form.account_email.trim() || null,
        purpose: form.purpose.trim() || null,
        renewal_date: form.renewal_date || null,
        renewal_cost: cost,
        renewal_currency: cost != null ? form.renewal_currency : null,
        notes: form.notes.trim() || null,
      })
      .eq("id", account.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a szolgáltatást."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Szolgáltatás neve *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.service_name}
            onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Fiók email-címe</label>
          <input
            type="email"
            className="input"
            value={form.account_email}
            onChange={(e) => setForm((f) => ({ ...f, account_email: e.target.value }))}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Cél</label>
          <input className="input" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Megújítás dátuma</label>
          <input
            type="date"
            className="input"
            value={form.renewal_date}
            onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Megújítás díja</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.renewal_cost}
            onChange={(e) => setForm((f) => ({ ...f, renewal_cost: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Pénznem</label>
          <select
            className="select"
            value={form.renewal_currency}
            onChange={(e) => setForm((f) => ({ ...f, renewal_currency: e.target.value as CurrencyCode }))}
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
