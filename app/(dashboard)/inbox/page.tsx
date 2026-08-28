"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Search, AlertTriangle, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { timeAgo } from "@/lib/format";

// Postaláda — a read-only view of the connected Gmail account's inbox
// (gmail.readonly scope, see lib/google-oauth.ts). No mark-as-read or
// archive actions by design; view only.

type InboxMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};

type InboxMessageDetail = InboxMessage & { bodyText: string };

type ApiFailure = { ok: false; error: string; code?: "gmail_not_connected" };

/** "Kis Anna <anna@example.com>" → "Kis Anna" (falls back to the raw header if there's no display name). */
function senderName(from: string): string {
  const match = from.match(/^"?([^"<]*)"?\s*<[^>]+>$/);
  const name = match?.[1]?.trim();
  return name || from;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [selected, setSelected] = useState<InboxMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async (q: string, pageToken?: string) => {
    if (pageToken) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`/api/gmail/messages?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const failure = data as ApiFailure;
        if (failure.code === "gmail_not_connected") setNotConnected(true);
        else setError(failure.error || "Nem sikerült betölteni a postaládát.");
        return;
      }
      setMessages((prev) => (pageToken ? [...prev, ...data.messages] : data.messages));
      setNextPageToken(data.nextPageToken ?? null);
    } catch {
      setError("Nem sikerült betölteni a postaládát.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(activeQuery);
  }, [activeQuery, load]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveQuery(query);
  }

  async function openMessage(id: string) {
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/gmail/messages/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setDetailError((data as ApiFailure).error || "Nem sikerült betölteni a levelet.");
        return;
      }
      setSelected(data.message);
    } catch {
      setDetailError("Nem sikerült betölteni a levelet.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Postaláda"
        subtitle="A csatlakoztatott Gmail-fiók bejövő levelei — csak megtekintésre."
      />

      {notConnected ? (
        <Link
          href="/settings"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">Gmail nincs összekapcsolva</span> — kattints ide az engedélyezéshez.
          </span>
        </Link>
      ) : (
        <>
          <form onSubmit={submitSearch} className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Keresés (pl. from:supplier@example.com, vagy egy szó a tárgyból)"
              />
            </div>
            <button type="submit" className="btn btn-ghost">
              Keresés
            </button>
          </form>

          {error && <ErrorBanner message={error} />}

          {loading ? (
            <Spinner />
          ) : messages.length === 0 ? (
            <EmptyState icon={Inbox} title="Nincs találat" description="Nincs üzenet ebben a postaládában, vagy nincs találat a keresésre." />
          ) : (
            <>
              <ul className="card flex flex-col divide-y divide-border overflow-hidden">
                {messages.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => openMessage(m.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ivory-dim/60"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${m.unread ? "bg-bronze" : "bg-transparent"}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className={`truncate text-sm ${m.unread ? "font-semibold text-forest" : "font-medium text-forest"}`}>
                            {senderName(m.from)}
                          </p>
                          <span className="shrink-0 text-xs text-muted">{timeAgo(m.date)}</span>
                        </div>
                        <p className="truncate text-sm text-forest/80">{m.subject}</p>
                        <p className="truncate text-xs text-muted">{m.snippet}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {nextPageToken && (
                <button
                  onClick={() => load(activeQuery, nextPageToken)}
                  disabled={loadingMore}
                  className="btn btn-ghost mt-4 w-full justify-center text-xs"
                >
                  {loadingMore ? "Betöltés…" : "Továbbiak betöltése"}
                </button>
              )}
            </>
          )}
        </>
      )}

      {(detailLoading || selected || detailError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
          onClick={() => {
            setSelected(null);
            setDetailError(null);
          }}
        >
          <div
            className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <h2 className="min-w-0 truncate font-serif text-lg text-forest">
                {selected?.subject ?? "Levél betöltése…"}
              </h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setDetailError(null);
                }}
                className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
                aria-label="Bezárás"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading && <Spinner />}
              {detailError && <ErrorBanner message={detailError} />}
              {selected && (
                <>
                  <p className="mb-3 text-xs text-muted">
                    {senderName(selected.from)} · {timeAgo(selected.date)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-forest">{selected.bodyText}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
