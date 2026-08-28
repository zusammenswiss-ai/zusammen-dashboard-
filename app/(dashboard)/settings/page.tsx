"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, Unplug } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Spinner } from "@/components/Feedback";

type GmailStatus = { configured: boolean; connected: boolean; email: string | null };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Beállítások" subtitle="Globális integrációk és fiók-összekapcsolások." />
      <Suspense fallback={<Spinner />}>
        <GmailConnectionCard />
      </Suspense>
    </>
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
