"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Send, Eye, X, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react";
import type { First20Signup, First20Email, First20EmailType } from "@/lib/supabase/types";
import { renderFirst20Email } from "@/lib/first20-emails";
import { FIRST20_EMAIL_TYPE_LABEL } from "@/lib/first20-signup-status";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const SEND_BUTTONS: { type: First20EmailType; label: (signup: First20Signup) => string }[] = [
  { type: "kit", label: (s) => (s.kit_sent_at ? "Készlet újraküldése" : "Készlet küldése") },
  { type: "reminder", label: () => "Emlékeztető küldése" },
  { type: "feedback", label: () => "Visszajelzés kérése" },
  { type: "order_confirmation", label: () => "Rendelés visszaigazolása" },
  { type: "custom", label: () => "Saját levél" },
];

const STATUS_BADGE: Record<First20Email["status"], { icon: typeof CheckCircle2; style: string; label: string }> = {
  sent: { icon: CheckCircle2, style: "bg-forest/10 text-forest", label: "Elküldve" },
  failed: { icon: XCircle, style: "bg-red-100 text-red-700", label: "Hiba" },
  queued: { icon: Clock, style: "bg-ivory-dim text-walnut", label: "Küldés…" },
};

export default function SignupEmailsTab({
  signup,
  emails,
  onSent,
}: {
  signup: First20Signup;
  emails: First20Email[];
  onSent: () => void;
}) {
  const [brevoStatus, setBrevoStatus] = useState<{ configured: boolean; missing: string[] } | null>(null);
  const [activeType, setActiveType] = useState<First20EmailType | null>(null);

  useEffect(() => {
    fetch("/api/marketing/brevo-status")
      .then((res) => res.json())
      .then(setBrevoStatus)
      .catch(() => setBrevoStatus({ configured: false, missing: ["BREVO_API_KEY"] }));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {brevoStatus && !brevoStatus.configured && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Brevo nincs beállítva — hiányzó környezeti változó
            {brevoStatus.missing.length > 1 ? "k" : ""}: <code>{brevoStatus.missing.join(", ")}</code>. Kérj egy API kulcsot a
            founder-től (Brevo → Settings → SMTP &amp; API), és állítsd be Vercelen. Addig az Előnézet működik, a Küldés nem.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SEND_BUTTONS.map(({ type, label }) => (
          <button key={type} type="button" className="btn btn-ghost text-xs" onClick={() => setActiveType(type)}>
            <Eye size={13} /> {label(signup)}
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-2 font-serif text-base text-forest">E-mail napló</h3>
        {emails.length === 0 ? (
          <p className="text-sm text-muted">Még nem küldtünk e-mailt ennek a jelentkezőnek.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {emails.map((email) => {
              const badge = STATUS_BADGE[email.status];
              const Icon = badge.icon;
              return (
                <div key={email.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-forest">{FIRST20_EMAIL_TYPE_LABEL[email.type]}</span>
                      <span className={`badge ${badge.style}`}>
                        <Icon size={11} /> {badge.label}
                      </span>
                      <span className="badge bg-ivory-dim text-walnut">{email.language.toUpperCase()}</span>
                      {email.trigger === "auto" && <span className="badge bg-forest-light/15 text-forest">Automata</span>}
                    </div>
                    {email.status === "failed" && email.error && <p className="mt-1 truncate text-xs text-red-600">{email.error}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">{formatDate(email.sent_at ?? email.created_at)}</span>
                    {email.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => setActiveType(email.type)}
                        className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
                      >
                        <RotateCcw size={12} /> Újraküldés
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeType && (
        <EmailPreviewModal
          signup={signup}
          type={activeType}
          brevoConfigured={brevoStatus?.configured ?? false}
          onClose={() => setActiveType(null)}
          onSent={() => {
            setActiveType(null);
            onSent();
          }}
        />
      )}
    </div>
  );
}

function EmailPreviewModal({
  signup,
  type,
  brevoConfigured,
  onClose,
  onSent,
}: {
  signup: First20Signup;
  type: First20EmailType;
  brevoConfigured: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState<"real" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const vars = {
    firstName: signup.first_name,
    kitUrl: `${origin}/first20-kit/kit-${signup.language_choice}.pdf`,
    feedbackUrl: `${origin}/first20/feedback/${signup.token ?? "…"}`,
    orderLanguage: signup.order_language,
  };
  const preview = renderFirst20Email(type, signup.language_choice, vars, {
    privacyUrl: `${origin}/adatvedelem`,
    unsubscribeHref: "#",
    customSubject: customSubject || "(add meg a tárgyat)",
    customBodyText: customBody,
  });

  async function send(mode: "real" | "test", force = false) {
    setSending(mode);
    setError(null);
    setDuplicateWarning(null);
    try {
      const res = await fetch("/api/marketing/first20/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupId: signup.id,
          type,
          mode,
          force,
          customSubject: type === "custom" ? customSubject : undefined,
          customBody: type === "custom" ? customBody : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setDuplicateWarning(data.error || "Ezt a levelet már elküldted 24 órán belül. Biztos újraküldöd?");
        return;
      }
      if (!data.ok) throw new Error(data.error || "Nem sikerült elküldeni.");
      if (mode === "test") {
        setResult({ ok: true, message: "Teszt levél elküldve: keresztesibarbara5@gmail.com" });
      } else {
        onSent();
      }
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült elküldeni."));
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]" onClick={onClose}>
      <div className="animate-fade-in card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-serif text-lg text-forest">
            {FIRST20_EMAIL_TYPE_LABEL[type]} — előnézet ({signup.language_choice.toUpperCase()})
          </h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        {type === "custom" && (
          <div className="flex flex-col gap-2 border-b border-border p-4">
            <input className="input" placeholder="Tárgy *" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} />
            <textarea
              className="textarea min-h-24"
              placeholder="Szöveg… (bekezdések üres sorral elválasztva)"
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p className="border-b border-border px-4 py-2 text-xs text-muted">
            Tárgy: <span className="font-medium text-forest">{preview.subject}</span>
          </p>
          <iframe title="E-mail előnézet" srcDoc={preview.html} className="min-h-[50vh] w-full flex-1" sandbox="" />
        </div>

        {!brevoConfigured && (
          <div className="flex items-start gap-2 border-t border-border bg-yellow-50 p-3 text-xs text-yellow-800">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Brevo nincs beállítva — a küldés most nem fog működni.
          </div>
        )}
        {duplicateWarning && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-amber-50 p-3 text-xs text-amber-800">
            <span>{duplicateWarning}</span>
            <button type="button" className="btn btn-primary !py-1 text-xs" onClick={() => send("real", true)} disabled={sending !== null}>
              Igen, küldd el mégis
            </button>
          </div>
        )}
        {error && <p className="border-t border-border px-4 py-2 text-xs text-red-600">{error}</p>}
        {result && <p className="border-t border-border px-4 py-2 text-xs text-forest">{result.message}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
          <button type="button" className="btn btn-ghost" onClick={() => send("test")} disabled={sending !== null || (type === "custom" && !customSubject.trim())}>
            {sending === "test" ? "Küldés…" : "Teszt küldés magamnak"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => send("real")}
            disabled={sending !== null || !brevoConfigured || (type === "custom" && !customSubject.trim())}
          >
            <Send size={15} /> {sending === "real" ? "Küldés…" : "Küldés"}
          </button>
        </div>
      </div>
    </div>
  );
}
