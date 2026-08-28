"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, MessageSquare } from "lucide-react";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import { timeAgo } from "@/lib/format";

type InboxMessage = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

type ApiFailure = { ok: false; error: string; code?: "gmail_not_connected" };

const PREVIEW_COUNT = 5;

/**
 * Shows the last few Gmail messages exchanged with `email` (both
 * directions — reused by Beszállítók and Megosztások profiles so a
 * contact's correspondence doesn't need re-fetching the whole inbox).
 * Fires onReplyDetected once, on mount, if any message actually came
 * FROM that address — the caller uses this to auto-flip "Válaszolt" /
 * "Megkeresve" without the founder having to check it by hand.
 */
export default function ContactCorrespondence({
  email,
  onReplyDetected,
}: {
  email: string | null;
  onReplyDetected?: () => void;
}) {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const trimmed = email?.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setNotConnected(false);
      try {
        const q = `(from:${trimmed}) OR (to:${trimmed})`;
        const res = await fetch(`/api/gmail/messages?q=${encodeURIComponent(q)}&maxResults=${PREVIEW_COUNT}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          const failure = data as ApiFailure;
          if (failure.code === "gmail_not_connected") setNotConnected(true);
          else setError(failure.error || "Nem sikerült betölteni a levelezést.");
          return;
        }
        const fetched = data.messages as InboxMessage[];
        setMessages(fetched);
        const hasReply = fetched.some((m) => m.from.toLowerCase().includes(trimmed.toLowerCase()));
        if (hasReply && !firedRef.current) {
          firedRef.current = true;
          onReplyDetected?.();
        }
      } catch {
        if (!cancelled) setError("Nem sikerült betölteni a levelezést.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onReplyDetected is intentionally excluded — callers pass a fresh
    // closure every render, and this effect should only re-run when the
    // contact's email actually changes, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  if (!email?.trim()) {
    return <p className="text-sm text-muted">Nincs email cím megadva.</p>;
  }
  if (notConnected) {
    return (
      <Link
        href="/settings"
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 transition-colors hover:bg-amber-100"
      >
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-medium">Gmail nincs összekapcsolva</span> — kattints ide az engedélyezéshez.
        </span>
      </Link>
    );
  }
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!messages || messages.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <MessageSquare size={14} /> Még nincs Gmail-levelezés ezzel a címmel.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {messages.map((m) => {
        const incoming = m.from.toLowerCase().includes(email.trim().toLowerCase());
        return (
          <li key={m.id} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
            {incoming ? (
              <ArrowDownLeft size={14} className="mt-0.5 shrink-0 text-forest" />
            ) : (
              <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-bronze" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium text-forest">{m.subject}</p>
                <span className="shrink-0 text-xs text-muted">{timeAgo(m.date)}</span>
              </div>
              <p className="truncate text-xs text-muted">{m.snippet}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
