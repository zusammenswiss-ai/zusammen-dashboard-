"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Mail, Send, AlertTriangle } from "lucide-react";
import { ErrorBanner } from "@/components/Feedback";

/** Shared "Email küldése" modal — posts to /api/send-email, which sends
 * via whichever provider is active server-side (Gmail by default, or
 * Resend — see lib/email/index.ts). Used from Beszállítók, Megrendelések,
 * Dokumentumok, Marketing, and Megosztások; each caller supplies sensible
 * defaults and reacts to a successful send via onSent (e.g. Beszállítók
 * auto-checks "Megkeresve"). */
export default function EmailComposeModal({
  title = "Email küldése",
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  onClose,
  onSent,
}: {
  title?: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onClose: () => void;
  onSent?: (payload: { to: string; subject: string; body: string }) => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gmailNotConnected, setGmailNotConnected] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function send() {
    setSending(true);
    setError(null);
    setGmailNotConnected(false);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.code === "gmail_not_connected") {
          setGmailNotConnected(true);
          return;
        }
        throw new Error(data.error || "Nem sikerült elküldeni az emailt.");
      }
      onSent?.({ to, subject, body });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült elküldeni az emailt.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg text-forest">
            <Mail size={17} /> {title}
          </h2>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {gmailNotConnected && (
            <Link
              href="/settings"
              className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-100"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">Gmail nincs összekapcsolva</span> — kattints ide az engedélyezéshez.
              </span>
            </Link>
          )}
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Címzett *</label>
              <input
                type="email"
                required
                autoFocus
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="cimzett@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Tárgy *</label>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email tárgya"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Üzenet *</label>
              <textarea
                className="textarea min-h-48"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Írd meg az üzenetet…"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="btn btn-ghost" disabled={sending}>
            Mégse
          </button>
          <button onClick={send} className="btn btn-primary" disabled={sending || !to || !subject || !body.trim()}>
            <Send size={15} /> {sending ? "Küldés…" : "Küldés"}
          </button>
        </div>
      </div>
    </div>
  );
}
