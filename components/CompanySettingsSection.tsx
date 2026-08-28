"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Signature, CalendarCheck, Banknote, Check, Upload } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CompanySettings, CompanySettingsUpdate, CurrencyCode } from "@/lib/supabase/types";
import { DEFAULT_EMAIL_SIGNATURE } from "@/lib/company-settings";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import { nextGoldCardDate, daysUntil } from "@/lib/gold-card";
import { formatDate } from "@/lib/format";
import { Spinner, ErrorBanner } from "@/components/Feedback";

/**
 * Loads the company_settings singleton row once and renders the 4
 * Beállítások cards that all read/write it (Márka-adatok, Email-
 * aláírás, Naptár-integráció, Pénznem) — one shared load + save so the
 * cards can never end up creating two competing rows, but still four
 * visually separate cards as asked for, each managing its own form
 * state and its own "Mentve" confirmation.
 */
export default function CompanySettingsSection() {
  const supabase = getSupabaseClient();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("company_settings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (loadError) setError(loadError.message);
    setSettings(data ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function patch(update: CompanySettingsUpdate): Promise<CompanySettings | null> {
    if (!supabase) return null;
    const { data, error: saveError } = settings
      ? await supabase.from("company_settings").update(update).eq("id", settings.id).select().single()
      : await supabase.from("company_settings").insert(update).select().single();
    if (saveError) {
      setError(saveError.message);
      return null;
    }
    setSettings(data);
    return data;
  }

  if (loading) return <Spinner />;

  return (
    <>
      {error && <ErrorBanner message={error} />}
      <BrandInfoCard settings={settings} onSave={patch} />
      <EmailSignatureCard settings={settings} onSave={patch} />
      <GoldCardReminderCard settings={settings} onSave={patch} />
      <CurrencyCard settings={settings} onSave={patch} />
    </>
  );
}

type CardProps = {
  settings: CompanySettings | null;
  onSave: (update: CompanySettingsUpdate) => Promise<CompanySettings | null>;
};

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-forest">
      <Check size={13} /> Mentve
    </span>
  );
}

function BrandInfoCard({ settings, onSave }: CardProps) {
  const supabase = getSupabaseClient();
  const [form, setForm] = useState({ companyName: "", address: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        companyName: settings.company_name ?? "",
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? "",
      });
    }
    // Only re-sync when the row's identity first appears (or a
    // different row loads) — not on every field-level save elsewhere on
    // this page, which would otherwise stomp on whatever the founder is
    // mid-typing here whenever, say, the Pénznem card saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const result = await onSave({
      company_name: form.companyName.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    });
    setSaving(false);
    if (result) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function uploadLogo(file: File) {
    if (!supabase) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("company-logo").upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const logoUrl = supabase.storage.from("company-logo").getPublicUrl(path).data.publicUrl;
      await onSave({ logo_url: logoUrl });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Nem sikerült feltölteni a logót.");
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Building2 size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Márka-adatok</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Cégnév, elérhetőségek és a logó — egy helyen, később más funkciók (pl. dokumentum-fejlécek) is ezt olvashatják.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-ivory-dim">
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="Logó" className="h-full w-full object-contain" />
          ) : (
            <Building2 size={22} className="text-muted/40" />
          )}
        </div>
        <div>
          <label className="btn btn-ghost cursor-pointer text-xs">
            <Upload size={14} /> {uploadingLogo ? "Feltöltés…" : "Logó feltöltése"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingLogo}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
                e.target.value = "";
              }}
            />
          </label>
          {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
        </div>
      </div>

      <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Cégnév</label>
          <input
            className="input"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            placeholder="Zusammen"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="zusammen.swiss@gmail.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Telefon</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+41 …"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Cím</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Utca, irányítószám, város"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={saving} className="btn btn-primary w-fit">
            {saving ? "Mentés…" : "Mentés"}
          </button>
          <SavedTick show={saved} />
        </div>
      </form>
    </div>
  );
}

function EmailSignatureCard({ settings, onSave }: CardProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(settings.email_signature ?? "");
    }
    // See BrandInfoCard's identical comment on why this keys off id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const result = await onSave({ email_signature: text.trim() || null });
    setSaving(false);
    if (result) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Signature size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Email-aláírás</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Automatikusan bekerül minden, a Dashboardból (Email küldése gombokkal) kiküldött email végére.
      </p>
      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <textarea
          className="textarea"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={DEFAULT_EMAIL_SIGNATURE}
        />
        <p className="text-xs text-muted">
          Üresen hagyva az alapértelmezett aláírás megy ki: „{DEFAULT_EMAIL_SIGNATURE}”
        </p>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary w-fit">
            {saving ? "Mentés…" : "Mentés"}
          </button>
          <SavedTick show={saved} />
        </div>
      </form>
    </div>
  );
}

function GoldCardReminderCard({ settings, onSave }: CardProps) {
  const [saving, setSaving] = useState(false);
  const enabled = settings?.gold_card_reminder_enabled ?? true;
  const nextDate = nextGoldCardDate(new Date());
  const days = daysUntil(nextDate, new Date());

  async function setEnabled(value: boolean) {
    setSaving(true);
    await onSave({ gold_card_reminder_enabled: value });
    setSaving(false);
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <CalendarCheck size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Naptár-integráció</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        A negyedéves Gold Card Letters esedékesség megjelenése a Naptáron és az Áttekintésen. A már lepecsételt
        levelek ettől függetlenül mindig látszanak.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-ivory-dim/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${enabled ? "bg-forest" : "bg-muted/50"}`} />
          <span className="text-forest">
            {enabled ? "Aktív" : "Szüneteltetve"} · következő: {formatDate(nextDate.toISOString())} ({days} nap)
          </span>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => setEnabled(!enabled)}
          className="btn btn-ghost shrink-0 text-xs"
        >
          {enabled ? "Szüneteltetés" : "Aktiválás"}
        </button>
      </div>

      {!enabled && (
        <button type="button" disabled={saving} onClick={() => setEnabled(true)} className="btn btn-primary mt-3 w-fit">
          Újra beállítás
        </button>
      )}
    </div>
  );
}

function CurrencyCard({ settings, onSave }: CardProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const currency = settings?.currency ?? "CHF";

  async function change(value: CurrencyCode) {
    setSaving(true);
    setSaved(false);
    const result = await onSave({ currency: value });
    setSaving(false);
    if (result) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Banknote size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Pénznem preferencia</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Milyen pénznemben jelenjenek meg az árak a Pénzügyek (Termékek) fülön. Ez csak a megjelenítést változtatja —
        nincs valós árfolyam-átváltás, a mögöttes szám nem módosul.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <select
          className="select w-auto"
          value={currency}
          disabled={saving}
          onChange={(e) => void change(e.target.value as CurrencyCode)}
        >
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <SavedTick show={saved} />
      </div>
    </div>
  );
}
