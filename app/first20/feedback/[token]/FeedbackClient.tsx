"use client";

import { useEffect, useState } from "react";
import type { First20Language, First20WouldBuy } from "@/lib/supabase/types";
import "../../first20.css";

const FOREST = "#233328";
const IVORY = "#f3efe7";
const BRONZE = "#b08a52";
const GOLD = "#c8a96b";

type SignupInfo = {
  first_name: string;
  partner_first_name: string | null;
  language_choice: First20Language;
  feedback_received_at: string | null;
};

const T: Record<
  First20Language,
  {
    title: string;
    intro: (name: string) => string;
    q1: string;
    q1Yes: string;
    q1No: string;
    q2: string;
    q2Placeholder: string;
    q3: string;
    q3Options: Record<First20WouldBuy, string>;
    q3WhyPlaceholder: string;
    submit: string;
    sending: string;
    thanksTitle: string;
    thanksBody: string;
    notFound: string;
    alreadyTitle: string;
    alreadyBody: string;
    error: string;
  }
> = {
  hu: {
    title: "Milyen volt az estétek?",
    intro: (name) => `Szia ${name}! Három rövid kérdés, kb. két perc.`,
    q1: "Megvolt az estétek?",
    q1Yes: "Igen",
    q1No: "Még nem",
    q2: "Melyik kártya tetszett a legjobban, vagy mit változtatnátok?",
    q2Placeholder: "Írjátok le röviden…",
    q3: "Megvennétek a teljes, 58 lapos paklit alapítói áron (CHF 24)?",
    q3Options: { igen: "Igen, azonnal", talan: "Talán, attól függ", nem: "Valószínűleg nem" },
    q3WhyPlaceholder: "Miért? (opcionális)",
    submit: "Visszajelzés elküldése",
    sending: "Küldés…",
    thanksTitle: "Köszönjük!",
    thanksBody: "Megkaptuk a visszajelzéseteket. Hamarosan jövünk a részletekkel, hogyan rendelhetitek meg a teljes paklit.",
    notFound: "Ezt a linket nem találjuk. Ha a levélből kattintottatok, kérjük, válaszoljatok rá, és segítünk.",
    alreadyTitle: "Megvan a visszajelzésetek",
    alreadyBody: "Már korábban elküldtétek — köszönjük! Ha módosítanátok valamit, egyszerűen válaszoljatok a kapott levélre.",
    error: "Nem sikerült elküldeni — próbáljátok újra, vagy válaszoljatok a levélre.",
  },
  de: {
    title: "Wie war euer Abend?",
    intro: (name) => `Hallo ${name}! Drei kurze Fragen, etwa zwei Minuten.`,
    q1: "Hattet ihr euren Abend schon?",
    q1Yes: "Ja",
    q1No: "Noch nicht",
    q2: "Welche Karte hat euch am besten gefallen, oder was würdet ihr ändern?",
    q2Placeholder: "Kurz beschreiben…",
    q3: "Würdet ihr das ganze Spiel mit 58 Karten zum Gründerpreis (CHF 24) kaufen?",
    q3Options: { igen: "Ja, sofort", talan: "Vielleicht, kommt drauf an", nem: "Eher nicht" },
    q3WhyPlaceholder: "Warum? (optional)",
    submit: "Feedback senden",
    sending: "Senden…",
    thanksTitle: "Danke!",
    thanksBody: "Wir haben euer Feedback erhalten. Wir melden uns bald mit den Details, wie ihr das ganze Spiel bestellen könnt.",
    notFound: "Diesen Link finden wir nicht. Falls ihr aus der E-Mail gekommen seid, antwortet einfach darauf — wir helfen euch.",
    alreadyTitle: "Euer Feedback ist angekommen",
    alreadyBody: "Ihr habt es schon geschickt — danke! Wenn ihr etwas ändern möchtet, antwortet einfach auf die E-Mail.",
    error: "Senden fehlgeschlagen — versucht es noch einmal, oder antwortet auf die E-Mail.",
  },
  en: {
    title: "How was your evening?",
    intro: (name) => `Hi ${name}! Three short questions, about two minutes.`,
    q1: "Have you had your evening yet?",
    q1Yes: "Yes",
    q1No: "Not yet",
    q2: "Which card did you like best, or what would you change?",
    q2Placeholder: "A few words…",
    q3: "Would you buy the full 58-card deck at the founders' price (CHF 24)?",
    q3Options: { igen: "Yes, right away", talan: "Maybe, depends", nem: "Probably not" },
    q3WhyPlaceholder: "Why? (optional)",
    submit: "Send feedback",
    sending: "Sending…",
    thanksTitle: "Thank you!",
    thanksBody: "We've received your feedback. We'll be in touch soon with details on how to order the full deck.",
    notFound: "We couldn't find this link. If you came from the email, just reply to it and we'll help.",
    alreadyTitle: "Your feedback is in",
    alreadyBody: "You've already sent this — thank you! If you'd like to change anything, just reply to the email you got.",
    error: "Couldn't send — try again, or reply to the email.",
  },
};

export default function FeedbackClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState<SignupInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [eveningDone, setEveningDone] = useState<boolean | null>(null);
  const [bestCardOrChange, setBestCardOrChange] = useState("");
  const [wouldBuy, setWouldBuy] = useState<First20WouldBuy | "">("");
  const [wouldBuyWhy, setWouldBuyWhy] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/first20/feedback/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setSignup(data.signup);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const lang = signup?.language_choice ?? "de";
  const t = T[lang];

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/first20/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eveningDone, bestCardOrChange, wouldBuy: wouldBuy || undefined, wouldBuyWhy }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(t.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: FOREST, color: IVORY }} className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {loading ? (
          <p className="text-center text-sm opacity-70">…</p>
        ) : notFound ? (
          <p className="text-center text-sm" style={{ opacity: 0.85 }}>
            {T.de.notFound}
          </p>
        ) : signup?.feedback_received_at || submitted ? (
          <div className="text-center">
            <h1 className="font-serif text-2xl" style={{ color: GOLD }}>
              {t.thanksTitle}
            </h1>
            <p className="mt-3 text-sm" style={{ opacity: 0.85 }}>
              {t.thanksBody}
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-2xl" style={{ color: GOLD }}>
              {t.title}
            </h1>
            <p className="mt-2 text-sm" style={{ opacity: 0.75 }}>
              {t.intro(signup?.first_name ?? "")}
            </p>

            <div className="mt-8 flex flex-col gap-6">
              <div>
                <p className="mb-2 text-sm font-medium">{t.q1}</p>
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setEveningDone(v)}
                      className="rounded-full px-4 py-2 text-sm"
                      style={{
                        border: `1px solid ${eveningDone === v ? GOLD : "rgba(243,239,231,0.25)"}`,
                        background: eveningDone === v ? GOLD : "transparent",
                        color: eveningDone === v ? FOREST : IVORY,
                      }}
                    >
                      {v ? t.q1Yes : t.q1No}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">{t.q2}</p>
                <textarea
                  className="first20-input min-h-20"
                  value={bestCardOrChange}
                  onChange={(e) => setBestCardOrChange(e.target.value)}
                  placeholder={t.q2Placeholder}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">{t.q3}</p>
                <div className="flex flex-col gap-2">
                  {(Object.keys(t.q3Options) as First20WouldBuy[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWouldBuy(opt)}
                      className="rounded-lg px-4 py-2.5 text-left text-sm"
                      style={{
                        border: `1px solid ${wouldBuy === opt ? GOLD : "rgba(243,239,231,0.25)"}`,
                        background: wouldBuy === opt ? "rgba(200,169,107,0.15)" : "transparent",
                        color: IVORY,
                      }}
                    >
                      {t.q3Options[opt]}
                    </button>
                  ))}
                </div>
                <input
                  className="first20-input mt-2"
                  value={wouldBuyWhy}
                  onChange={(e) => setWouldBuyWhy(e.target.value)}
                  placeholder={t.q3WhyPlaceholder}
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="mt-6 w-full rounded-full px-5 py-3 text-sm font-medium"
              style={{ background: BRONZE, color: FOREST }}
            >
              {sending ? t.sending : t.submit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
