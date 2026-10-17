"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Package,
  Clock,
  MessageSquareText,
  ReceiptText,
  PenLine,
  Send,
  FlaskConical,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Mail,
} from "lucide-react";
import type { First20Signup, First20Email, First20EmailType, First20Language } from "@/lib/supabase/types";
import { renderFirst20Email } from "@/lib/first20-emails";
import { FIRST20_EMAIL_TYPE_LABEL } from "@/lib/first20-signup-status";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import EntityMailThreadsSection from "@/components/mail/EntityMailThreadsSection";

const SEND_BUTTONS: {
  type: First20EmailType;
  icon: typeof Package;
  label: (signup: First20Signup) => string;
  hint: (signup: First20Signup) => string | null;
}[] = [
  {
    type: "kit",
    icon: Package,
    label: (s) => (s.kit_sent_at ? "Készlet újraküldése" : "Készlet küldése"),
    hint: (s) => (s.kit_sent_at ? `Elküldve: ${formatDate(s.kit_sent_at)}` : null),
  },
  {
    type: "reminder",
    icon: Clock,
    label: () => "Emlékeztető küldése",
    hint: (s) => (s.reminder_sent_at ? `Elküldve: ${formatDate(s.reminder_sent_at)}` : null),
  },
  {
    type: "feedback",
    icon: MessageSquareText,
    label: () => "Visszajelzés kérése",
    hint: (s) => (s.feedback_mail_sent_at ? `Elküldve: ${formatDate(s.feedback_mail_sent_at)}` : null),
  },
  {
    type: "order_confirmation",
    icon: ReceiptText,
    label: () => "Rendelés visszaigazolása",
    hint: () => null,
  },
  {
    type: "custom",
    icon: PenLine,
    label: () => "Saját levél",
    hint: () => null,
  },
];

const LANGUAGES: First20Language[] = ["hu", "de", "en"];
const LANG_LABEL: Record<First20Language, string> = { hu: "Magyar", de: "Német", en: "Angol" };

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
  const [mailStatus, setMailStatus] = useState<{ configured: boolean; missing: string[] } | null>(null);
  const [activeType, setActiveType] = useState<First20EmailType | null>(null);

  useEffect(() => {
    fetch("/api/mail/send-status")
      .then((res) => res.json())
      .then(setMailStatus)
      .catch(() => setMailStatus({ configured: false, missing: ["MAIL_ENCRYPTION_KEY"] }));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {mailStatus && !mailStatus.configured && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Nincs küldésre kész postafiók — hiányzik: <code>{mailStatus.missing.join(", ")}</code>. Állítsd be a Postafiók → Fiókok
            fülön (lásd a Postafiók oldalt). Addig az Előnézet működik, a Küldés nem.
          </span>
        </div>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-1.5 font-serif text-base text-forest">
          <Mail size={16} className="text-bronze" /> Levél küldése
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SEND_BUTTONS.map(({ type, icon: Icon, label, hint }) => {
            const hintText = hint(signup);
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white p-4 text-center transition-colors hover:border-bronze/50 hover:bg-ivory-dim/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bronze/10 text-bronze">
                  <Icon size={18} />
                </span>
                <span className="text-xs font-medium leading-tight text-forest">{label(signup)}</span>
                {hintText && <span className="text-[10px] text-muted">{hintText}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section>
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
      </section>

      <section>
        <EntityMailThreadsSection entityType="signup" entityIds={[signup.id]} title="Levelek (Postafiók)" />
      </section>

      {activeType && (
        <EmailPreviewModal
          signup={signup}
          type={activeType}
          mailConfigured={mailStatus?.configured ?? false}
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

const FOUNDER_TEST_EMAIL = "keresztesibarbara5@gmail.com";

function EmailPreviewModal({
  signup,
  type,
  mailConfigured,
  onClose,
  onSent,
}: {
  signup: First20Signup;
  type: First20EmailType;
  mailConfigured: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [language, setLanguage] = useState<First20Language>(signup.language_choice);
  const [sending, setSending] = useState<"real" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const vars = {
    firstName: signup.first_name,
    kitUrl: `${origin}/first20-kit/kit-${language}.pdf`,
    feedbackUrl: `${origin}/first20/feedback/${signup.token ?? "…"}`,
    orderLanguage: signup.order_language,
  };
  const preview = renderFirst20Email(type, language, vars, {
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
          language,
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
        setResult({ ok: true, message: `Teszt levél elküldve: ${FOUNDER_TEST_EMAIL}` });
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
    // overflow-y-auto a backdropon, SEM max-height a kártyán, SEM belső
    // (második) scroll-konténer — a fejléc és a lábléc sticky, a tartalom
    // meg egyszerűen a backdroppal együtt görgethető. Korábban (ld. git
    // history) egy max-h-[...vh] + belső overflow-y-auto kombó próbálta
    // egyetlen képernyőre beszorítani az egészet, de rövid böngésző-
    // ablaknál/Dock-takarásnál így sem fért ki minden — a Bezárás X és a
    // Küldés gombok is levághattak, és egyszerre csak az egyik volt
    // elérhető görgetéssel. Sticky fejléc/lábléc esetén mindkettő mindig
    // a képernyőn marad, bármekkora is a tartalom vagy az ablak.
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-forest/40 px-2 py-4 backdrop-blur-[2px] sm:px-4 sm:py-8" onClick={onClose}>
      <div className="animate-fade-in card mx-auto w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-ivory-dim p-4">
          <h3 className="flex items-center gap-2 font-serif text-lg text-forest">
            <Mail size={17} className="text-bronze" /> {FIRST20_EMAIL_TYPE_LABEL[type]}
          </h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-white" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 sm:px-5">
          <span className="text-xs font-medium text-muted">Nyelv</span>
          <div className="flex gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`btn !py-1 text-xs ${language === lang ? "btn-bronze" : "btn-ghost"}`}
              >
                {LANG_LABEL[lang]}
              </button>
            ))}
          </div>
          {language !== signup.language_choice && (
            <span className="text-[11px] text-muted">
              (a jelentkező saját nyelve: {LANG_LABEL[signup.language_choice]})
            </span>
          )}
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

        <div className="bg-ivory-dim/30 p-3 sm:p-5">
          {/* Email-kliens-szerű fejléc, hogy ez egyértelműen egy valódi
              levél előnézete legyen, ne csak egy nyers HTML-dobozka. */}
          <div className="rounded-t-lg border border-border bg-white px-4 py-3 text-xs">
            <div className="flex gap-2">
              <span className="w-14 shrink-0 text-muted">Feladó</span>
              <span className="text-forest">Zusammen</span>
            </div>
            <div className="mt-1 flex gap-2">
              <span className="w-14 shrink-0 text-muted">Címzett</span>
              <span className="text-forest">
                {signup.first_name}
                {signup.partner_first_name ? ` & ${signup.partner_first_name}` : ""} &lt;{signup.email}&gt;
              </span>
            </div>
            <div className="mt-1 flex gap-2 border-t border-border pt-1.5">
              <span className="w-14 shrink-0 text-muted">Tárgy</span>
              <span className="font-medium text-forest">{preview.subject}</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-b-lg border border-t-0 border-border bg-white shadow-sm">
            <iframe title="E-mail előnézet" srcDoc={preview.html} className="h-[50vh] w-full sm:h-[55vh]" sandbox="" />
          </div>
        </div>

        {!mailConfigured && (
          <div className="flex items-start gap-2 border-t border-border bg-yellow-50 p-3 text-xs text-yellow-800">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Nincs küldésre kész postafiók — a küldés most nem fog működni.
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

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-white p-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => send("test")}
            disabled={sending !== null || (type === "custom" && !customSubject.trim())}
          >
            <FlaskConical size={14} /> {sending === "test" ? "Küldés…" : "Teszt küldés magamnak"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => send("real")}
            disabled={sending !== null || !mailConfigured || (type === "custom" && !customSubject.trim())}
          >
            <Send size={15} /> {sending === "real" ? "Küldés…" : "Küldés"}
          </button>
        </div>
      </div>
    </div>
  );
}
