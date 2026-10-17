"use client";

import { useEffect, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, MailAccountSummary } from "@/lib/supabase/types";
import { ErrorBanner } from "@/components/Feedback";
import { errorMessage } from "@/lib/errors";

/**
 * "Új levél írása" — fiók, címzett (jelentkező-választóból vagy szabad
 * cím), tárgy, szöveg (feladat 4. pont). Mindig a Postaládából nyitott,
 * önálló szálat indít — válaszhoz lásd MailThreadView ReplyAndNoteComposer.
 */
export default function MailComposeModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [accounts, setAccounts] = useState<MailAccountSummary[]>([]);
  const [signups, setSignups] = useState<First20Signup[]>([]);
  const [accountId, setAccountId] = useState("");
  const [signupId, setSignupId] = useState("");
  const [to, setTo] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    (async () => {
      const [accountsRes, signupsRes] = await Promise.all([
        fetch("/api/mail/accounts").then((r) => r.json()),
        supabase ? supabase.from("first20_signups").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      if (accountsRes.ok) {
        setAccounts(accountsRes.accounts);
        const def = accountsRes.accounts.find((a: MailAccountSummary) => a.is_default) || accountsRes.accounts[0];
        if (def) setAccountId(def.id);
      }
      setSignups(signupsRes.data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickSignup(id: string) {
    setSignupId(id);
    const s = signups.find((x) => x.id === id);
    if (s) {
      setTo(s.email);
      setToName(s.first_name);
    }
  }

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("Címzett, tárgy és szöveg megadása kötelező.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const html = body
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const res = await fetch("/api/mail/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, to: to.trim(), toName: toName.trim() || undefined, subject: subject.trim(), html, signupId: signupId || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült elküldeni.");
      onSent();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült elküldeni."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-forest/40 px-2 py-4 backdrop-blur-[2px] sm:px-4 sm:py-8" onClick={onClose}>
      <div className="animate-fade-in card mx-auto w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-ivory-dim p-4">
          <h3 className="font-serif text-lg text-forest">Új levél írása</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-white" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {error && <ErrorBanner message={error} />}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Küldő fiók</label>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>

          {signups.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Jelentkező választása (opcionális)</label>
              <select className="select" value={signupId} onChange={(e) => pickSignup(e.target.value)}>
                <option value="">— szabad cím megadása —</option>
                {signups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} ({s.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Címzett e-mail cím *</label>
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Tárgy *</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Szöveg *</label>
            <textarea className="textarea min-h-32" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-white p-4">
          <button type="button" onClick={onClose} className="btn btn-ghost" disabled={sending}>
            Mégse
          </button>
          <button type="button" onClick={() => void send()} className="btn btn-primary" disabled={sending}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Küldés
          </button>
        </div>
      </div>
    </div>
  );
}
