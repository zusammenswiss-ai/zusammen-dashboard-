"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, Star, PlugZap, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { MailAccountSummary, MailSecureMode } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const SECURE_LABEL: Record<MailSecureMode, string> = { tls: "SSL/TLS", starttls: "STARTTLS", none: "Nincs titkosítás" };

type FormState = {
  name: string;
  email: string;
  from_name: string;
  imap_host: string;
  imap_port: number;
  imap_secure: MailSecureMode;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: MailSecureMode;
  username: string;
  password: string;
  signature_html: string;
  signature_text: string;
  is_default: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  from_name: "",
  imap_host: "mail.infomaniak.com",
  imap_port: 993,
  imap_secure: "tls",
  smtp_host: "mail.infomaniak.com",
  smtp_port: 465,
  smtp_secure: "tls",
  username: "",
  password: "",
  signature_html: "",
  signature_text: "",
  is_default: false,
};

function accountToForm(a: MailAccountSummary): FormState {
  return {
    name: a.name,
    email: a.email,
    from_name: a.from_name ?? "",
    imap_host: a.imap_host,
    imap_port: a.imap_port,
    imap_secure: a.imap_secure,
    smtp_host: a.smtp_host,
    smtp_port: a.smtp_port,
    smtp_secure: a.smtp_secure,
    username: a.username,
    password: "",
    signature_html: a.signature_html ?? "",
    signature_text: a.signature_text ?? "",
    is_default: a.is_default,
  };
}

/**
 * Postafiók → Fiókok — Infomaniak IMAP/SMTP postafiókok kezelése. Minden
 * olvasás/írás az app/api/mail/accounts route-okon keresztül megy, SOHA
 * nem a böngésző Supabase-klienssel (a mail_accounts tábla RLS-sel
 * védett, policy nélkül — lásd supabase/schema.sql), ezért ez a
 * komponens fetch()-et használ a megszokott `getSupabaseClient()` helyett.
 */
export default function MailAccountsSection() {
  const [accounts, setAccounts] = useState<MailAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<"new" | string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/accounts");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült betölteni a postafiókokat.");
      setAccounts(data.accounts);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült betölteni a postafiókokat."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleDelete(account: MailAccountSummary) {
    const keepMessages = window.confirm(
      `Biztosan törlöd a(z) "${account.name}" postafiókot?\n\nOK = a fiók törlődik, de a hozzá tartozó levelek MEGMARADNAK a Postafiókban.\nMégse = nem történik semmi.`
    );
    if (!keepMessages) return;
    const alsoDeleteMessages = window.confirm(
      "A hozzá tartozó LEVELEKET is törlöd? OK = igen, minden levél törlődik. Mégse = a levelek megmaradnak."
    );
    try {
      const res = await fetch(`/api/mail/accounts/${account.id}?deleteMessages=${alsoDeleteMessages ? "true" : "false"}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült törölni.");
      void load();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült törölni a postafiókot."));
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Infomaniak (vagy más IMAP/SMTP) postafiókok — innen küld a Dashboard, és ide köthetők a beérkező válaszok.
        </p>
        <button
          type="button"
          className="btn btn-bronze shrink-0 !px-3 !py-1.5 text-xs"
          onClick={() => setShowForm(showForm === "new" ? null : "new")}
        >
          <Plus size={14} /> Új postafiók
        </button>
      </div>

      {showForm === "new" && (
        <MailAccountForm
          initial={EMPTY_FORM}
          submitLabel="Postafiók hozzáadása"
          onCancel={() => setShowForm(null)}
          onSaved={() => {
            setShowForm(null);
            void load();
          }}
          endpoint="/api/mail/accounts"
          method="POST"
        />
      )}

      {accounts.length === 0 ? (
        <EmptyState icon={PlugZap} title="Még nincs postafiók beállítva" description="Vedd fel az elsőt az 'Új postafiók' gombbal." />
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((account) =>
            showForm === account.id ? (
              <MailAccountForm
                key={account.id}
                initial={accountToForm(account)}
                submitLabel="Mentés"
                onCancel={() => setShowForm(null)}
                onSaved={() => {
                  setShowForm(null);
                  void load();
                }}
                endpoint={`/api/mail/accounts/${account.id}`}
                method="PATCH"
              />
            ) : (
              <MailAccountRow key={account.id} account={account} onEdit={() => setShowForm(account.id)} onDelete={() => handleDelete(account)} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function MailAccountRow({ account, onEdit, onDelete }: { account: MailAccountSummary; onEdit: () => void; onDelete: () => void }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ imap: { ok: boolean; error?: string }; smtp: { ok: boolean; error?: string } } | null>(
    null
  );

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/mail/accounts/${account.id}/test`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "A teszt nem futott le.");
      setTestResult({ imap: data.imap, smtp: data.smtp });
    } catch (err) {
      const msg = errorMessage(err, "A teszt nem futott le.");
      setTestResult({ imap: { ok: false, error: msg }, smtp: { ok: false, error: msg } });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium text-forest">{account.name}</p>
            {account.is_default && (
              <span className="badge bg-bronze/10 text-bronze">
                <Star size={11} /> Alapértelmezett
              </span>
            )}
            {!account.is_active && <span className="badge bg-red-100 text-red-700">Inaktív</span>}
          </div>
          <p className="truncate text-sm text-muted">{account.email}</p>
          <p className="mt-1 text-[11px] text-muted">
            IMAP {account.imap_host}:{account.imap_port} ({SECURE_LABEL[account.imap_secure]}) · SMTP {account.smtp_host}:
            {account.smtp_port} ({SECURE_LABEL[account.smtp_secure]})
          </p>
          {account.last_test_at && (
            <p className={`mt-1 text-[11px] ${account.last_test_ok ? "text-forest" : "text-red-600"}`}>
              Utolsó teszt: {formatDate(account.last_test_at)} — {account.last_test_ok ? "sikeres" : account.last_test_error || "hiba"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={runTest} disabled={testing} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
            {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />} Kapcsolat tesztelése
          </button>
          <button type="button" onClick={onEdit} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Szerkesztés">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Törlés">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {testResult && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
          <TestResultLine label="IMAP" result={testResult.imap} />
          <TestResultLine label="SMTP" result={testResult.smtp} />
        </div>
      )}
    </div>
  );
}

function TestResultLine({ label, result }: { label: string; result: { ok: boolean; error?: string } }) {
  return (
    <div className={`flex items-start gap-1.5 ${result.ok ? "text-forest" : "text-red-600"}`}>
      {result.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
      <span>
        <span className="font-medium">{label}:</span> {result.ok ? "sikeres kapcsolat" : result.error}
      </span>
    </div>
  );
}

function MailAccountForm({
  initial,
  submitLabel,
  onCancel,
  onSaved,
  endpoint,
  method,
}: {
  initial: FormState;
  submitLabel: string;
  onCancel: () => void;
  onSaved: () => void;
  endpoint: string;
  method: "POST" | "PATCH";
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = method === "PATCH";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.username.trim()) {
      setError("Név, e-mail és felhasználónév megadása kötelező.");
      return;
    }
    if (!isEdit && !form.password.trim()) {
      setError("Jelszó megadása kötelező.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        from_name: form.from_name.trim() || null,
        imap_host: form.imap_host.trim(),
        imap_port: form.imap_port,
        imap_secure: form.imap_secure,
        smtp_host: form.smtp_host.trim(),
        smtp_port: form.smtp_port,
        smtp_secure: form.smtp_secure,
        username: form.username.trim(),
        signature_html: form.signature_html.trim() || null,
        signature_text: form.signature_text.trim() || null,
        is_default: form.is_default,
      };
      if (form.password.trim()) body.password = form.password;
      const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült menteni.");
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-bronze/30 bg-ivory-dim/40 p-4">
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
          <input className="input" placeholder="pl. Zusammen hello" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">E-mail cím *</label>
          <input
            className="input"
            type="email"
            placeholder="hello@das-zusammen.ch"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Küldő név</label>
          <input className="input" placeholder="Zusammen" value={form.from_name} onChange={(e) => set("from_name", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Felhasználónév *</label>
          <input className="input" value={form.username} onChange={(e) => set("username", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-muted">IMAP (bejövő)</legend>
          <div className="flex flex-col gap-2">
            <input className="input" placeholder="Host" value={form.imap_host} onChange={(e) => set("imap_host", e.target.value)} />
            <div className="flex gap-2">
              <input
                className="input w-24"
                type="number"
                value={form.imap_port}
                onChange={(e) => set("imap_port", Number(e.target.value) || 0)}
              />
              <select className="select flex-1" value={form.imap_secure} onChange={(e) => set("imap_secure", e.target.value as MailSecureMode)}>
                <option value="tls">SSL/TLS</option>
                <option value="starttls">STARTTLS</option>
                <option value="none">Nincs titkosítás</option>
              </select>
            </div>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-muted">SMTP (kimenő)</legend>
          <div className="flex flex-col gap-2">
            <input className="input" placeholder="Host" value={form.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} />
            <div className="flex gap-2">
              <input
                className="input w-24"
                type="number"
                value={form.smtp_port}
                onChange={(e) => set("smtp_port", Number(e.target.value) || 0)}
              />
              <select className="select flex-1" value={form.smtp_secure} onChange={(e) => set("smtp_secure", e.target.value as MailSecureMode)}>
                <option value="tls">SSL/TLS</option>
                <option value="starttls">STARTTLS</option>
                <option value="none">Nincs titkosítás</option>
              </select>
            </div>
          </div>
        </fieldset>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{isEdit ? "Jelszó módosítása (üresen hagyva marad a régi)" : "Jelszó *"}</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder={isEdit ? "••••••••" : ""}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Aláírás (szöveg)</label>
          <textarea className="textarea min-h-20" value={form.signature_text} onChange={(e) => set("signature_text", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Aláírás (HTML, opcionális)</label>
          <textarea className="textarea min-h-20 font-mono text-xs" value={form.signature_html} onChange={(e) => set("signature_html", e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-forest">
        <input type="checkbox" checked={form.is_default} onChange={(e) => set("is_default", e.target.checked)} />
        Legyen ez az alapértelmezett küldő fiók
      </label>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          <X size={14} /> Mégse
        </button>
        <button type="submit" className="btn btn-bronze" disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {submitLabel}
        </button>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-muted">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />A jelszó titkosítva tárolódik, és a böngésző soha nem kapja vissza —
        csak azt látod, hogy be van-e állítva.
      </p>
    </form>
  );
}
