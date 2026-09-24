"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Check, ShieldCheck, KeyRound, Trash2 } from "lucide-react";
import { Spinner } from "@/components/Feedback";

type Status = {
  provider: "gmail" | "resend";
  apiKeyConfigured: boolean;
  apiKeySource: "database" | "env" | "none";
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

/**
 * Beállítások → "Email küldés" — a Beszállítók/Megrendelések/stb. "Email
 * küldése" gombok mögötti szolgáltató (Gmail vagy Resend) és — Resendnél
 * — az API-kulcs, feladó-név/-cím, válaszcím beállítása a dashboardból,
 * hogy ne kelljen ehhez a Vercel környezeti változóit szerkeszteni. A
 * domain-igazolás (DNS-rekordok a domain-szolgáltatónál) ettől
 * függetlenül, egyszer, külön el kell végezni — ezt semmilyen
 * alkalmazás-beli beállítás nem tudja kiváltani, lásd az alábbi
 * figyelmeztető szöveget.
 */
export default function EmailSendSettingsSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<"gmail" | "resend">("gmail");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-settings");
      const data = (await res.json()) as Status;
      setStatus(data);
      setProvider(data.provider);
      setFromName(data.fromName);
      setFromEmail(data.fromEmail);
      setReplyTo(data.replyTo);
    } catch {
      setError("Nem sikerült betölteni az email küldés beállításait.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKeyInput.trim() || undefined,
          fromName,
          fromEmail,
          replyTo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Nem sikerült menteni.");
      setStatus(data.status);
      setApiKeyInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni.");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    setClearingKey(true);
    try {
      const res = await fetch("/api/email-settings/clear-key", { method: "POST" });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } finally {
      setClearingKey(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Mail size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Email küldés</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Melyik szolgáltatón keresztül menjenek ki az „Email küldése” gombok (Beszállítók, Megrendelések, Dokumentumok,
        Marketing, Megosztások), és — Resend választása esetén — milyen API-kulccsal, feladó-névvel/-címmel.
      </p>
      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-ivory-dim px-3 py-2 text-xs text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-bronze" />
        Egy lépés innen nem intézhető: a feladó email-cím domainjét (pl. das-zusammen.ch) egyszer, a domain-
        szolgáltatódnál kell igazolni (DNS-rekordok hozzáadásával) — ez a levélhamisítás elleni védelem, nem a
        dashboard hiányossága. Enélkül a Resend a saját, korlátozott „onboarding@resend.dev” címéről küld helyette.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-4 flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setProvider("gmail")}
            className={`btn !px-3 !py-1.5 text-xs ${provider === "gmail" ? "btn-primary" : "btn-ghost"}`}
          >
            Gmail
          </button>
          <button
            type="button"
            onClick={() => setProvider("resend")}
            className={`btn !px-3 !py-1.5 text-xs ${provider === "resend" ? "btn-primary" : "btn-ghost"}`}
          >
            Resend
          </button>
        </div>

        {provider === "resend" && (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <KeyRound size={12} /> Resend API-kulcs
              </label>
              <input
                type="password"
                className="input"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={status?.apiKeyConfigured ? "•••••••••••••••• (beállítva — üresen hagyva változatlan marad)" : "re_..."}
                autoComplete="off"
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {status?.apiKeySource === "database"
                    ? "Beállítva innen (adatbázisban tárolva, titkosítva)."
                    : status?.apiKeySource === "env"
                      ? "Beállítva a Vercel RESEND_API_KEY környezeti változójával."
                      : "Még nincs beállítva."}
                </p>
                {status?.apiKeySource === "database" && (
                  <button
                    type="button"
                    onClick={clearKey}
                    disabled={clearingKey}
                    className="flex shrink-0 items-center gap-1 text-xs text-muted/70 hover:text-red-600"
                  >
                    <Trash2 size={12} /> {clearingKey ? "Törlés…" : "Kulcs törlése"}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Feladó neve</label>
                <input
                  className="input"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Zusammen"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Feladó email címe</label>
                <input
                  type="email"
                  className="input"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="connect@das-zusammen.ch"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Válaszcím (Reply-To)</label>
              <input
                type="email"
                className="input"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="connect@das-zusammen.ch"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary w-fit">
            {saving ? "Mentés…" : "Mentés"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-forest">
              <Check size={13} /> Mentve
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
