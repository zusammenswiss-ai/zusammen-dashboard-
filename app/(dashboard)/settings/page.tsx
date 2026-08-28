"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, Unplug, HeartHandshake, Copy, Check, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Spinner } from "@/components/Feedback";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { TogetherSettings } from "@/lib/supabase/types";
import { generateAccessCode } from "@/lib/together";

type GmailStatus = { configured: boolean; connected: boolean; email: string | null };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Beállítások" subtitle="Globális integrációk és fiók-összekapcsolások." />
      <div className="flex flex-col gap-6">
        <Suspense fallback={<Spinner />}>
          <GmailConnectionCard />
        </Suspense>
        {isSupabaseConfigured && <TogetherAccessCard />}
      </div>
    </>
  );
}

function TogetherAccessCard() {
  const supabase = getSupabaseClient();
  const [settings, setSettings] = useState<TogetherSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("together_settings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSettings(data ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    if (supabase) void load();
  }, [supabase, load]);

  async function generate() {
    if (!supabase) return;
    setGenerating(true);
    const code = generateAccessCode();
    const { data, error } = settings
      ? await supabase.from("together_settings").update({ access_code: code }).eq("id", settings.id).select().single()
      : await supabase.from("together_settings").insert({ access_code: code }).select().single();
    setGenerating(false);
    if (!error && data) setSettings(data);
  }

  const link = settings && origin ? `${origin}/together?code=${settings.access_code}` : "";

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can be unavailable — the link is still visible to select and copy manually.
    }
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <HeartHandshake size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Közös tér linkje</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        A /together oldal — Gold Card Letters, Journey/Passport és a Meglepetés kérdés — a partnerednek is
        elérhető, a fő Dashboard-bejelentkezés nélkül, egyedül ezzel a linkkel.
      </p>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {settings && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-ivory-dim/60 px-4 py-3">
              <label className="text-xs font-medium text-muted">Link</label>
              <div className="flex flex-wrap items-center gap-2">
                <input className="input min-w-0 flex-1 font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
                <button type="button" onClick={copyLink} className="btn btn-ghost shrink-0 text-xs" disabled={!link}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Másolva" : "Másolás"}
                </button>
              </div>
              <p className="text-xs text-muted">
                Kód: <span className="font-mono font-medium text-forest">{settings.access_code}</span>
              </p>
            </div>
          )}
          <button type="button" onClick={generate} disabled={generating} className="btn btn-primary mt-4 w-fit">
            <RefreshCw size={15} /> {generating ? "Generálás…" : settings ? "Új kód generálása" : "Link generálása"}
          </button>
          {settings && (
            <p className="mt-2 text-xs text-muted">
              Új kód generálása érvényteleníti a régi linket — akinek korábban elküldted, annak újra el kell küldeni.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function GmailConnectionCard() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const callbackResult = searchParams.get("gmail"); // "connected" | "error" | null
  const callbackError = searchParams.get("gmail_error");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/gmail/status");
      const data = (await res.json()) as GmailStatus;
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus();
  }, [loadStatus]);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/gmail/disconnect", { method: "POST" });
      await loadStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="card max-w-xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Mail size={18} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Gmail összekapcsolása</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Az összes „Email küldése” gomb (Beszállítók, Megrendelések, Dokumentumok, Marketing, Megosztások) ezen a
        fiókon keresztül küldi ki az emaileket, és a Postaláda oldal is ezt olvassa.
      </p>
      <p className="mt-1 text-xs text-muted">
        Ha még a levélolvasás bevezetése előtt kapcsoltad össze a Gmailt, a Postaláda „Gmail nincs összekapcsolva”
        hibát fog mutatni, amíg egyszer nem bontod a kapcsolatot és kapcsolod össze újra — az új jogosultsághoz
        (gmail.readonly) újbóli engedélyezés kell.
      </p>

      {callbackResult === "connected" && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-forest/5 px-3 py-2 text-sm text-forest">
          <CheckCircle2 size={15} /> Sikeresen összekapcsolva!
        </p>
      )}
      {callbackResult === "error" && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {callbackError || "Nem sikerült összekapcsolni a Gmail fiókot."}
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : !status?.configured ? (
        <p className="mt-4 rounded-lg bg-ivory-dim px-3 py-2 text-sm text-muted">
          A Google OAuth nincs beállítva a szerveren (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET hiányzik) — lásd a
          README-t a beállításhoz.
        </p>
      ) : status.connected ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-ivory-dim/60 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="text-forest" />
            <span className="text-forest">
              Összekapcsolva{status.email ? <>: <span className="font-medium">{status.email}</span></> : null}
            </span>
          </div>
          <button onClick={disconnect} disabled={disconnecting} className="btn btn-ghost text-xs">
            <Unplug size={14} /> {disconnecting ? "Bontás…" : "Kapcsolat bontása"}
          </button>
        </div>
      ) : (
        <a href="/api/auth/gmail/start" className="btn btn-primary mt-4 w-fit">
          <Mail size={16} /> Gmail összekapcsolása
        </a>
      )}
    </div>
  );
}
