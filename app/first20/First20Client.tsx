"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Check, Sparkle } from "lucide-react";
import {
  first20T,
  FIRST20_LANGS,
  HOW_HEARD_OPTIONS,
  type First20Lang,
  type HowHeardOption,
} from "@/lib/first20-i18n";
import HeroCards, { FIRST20_SUIT_ICONS } from "@/components/first20/HeroCards";
import "./first20.css";

const FOREST = "#233328";
const IVORY = "#f3efe7";
const BRONZE = "#b08a52";
const GOLD = "#c8a96b";
const WALNUT = "#7a5a3b";

type FormState = {
  firstName: string;
  email: string;
  partnerFirstName: string;
  languageChoice: First20Lang;
  howHeard: HowHeardOption | "";
  consent: boolean;
  website: string; // honeypot
};

function emptyForm(lang: First20Lang): FormState {
  return { firstName: "", email: "", partnerFirstName: "", languageChoice: lang, howHeard: "", consent: false, website: "" };
}

export default function First20Client({
  initialLang,
  signupCount,
  privacyHref,
  utmSource,
  utmMedium,
}: {
  initialLang: First20Lang;
  signupCount: number;
  privacyHref: string;
  utmSource: string | null;
  utmMedium: string | null;
}) {
  const [lang, setLang] = useState<First20Lang>(initialLang);
  const t = first20T[lang];
  const signupRef = useRef<HTMLDivElement>(null);

  function scrollToSignup() {
    signupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ backgroundColor: IVORY, color: FOREST }} className="min-h-screen font-sans">
      <LangToggle lang={lang} onChange={setLang} />

      <Hero t={t} onCtaClick={scrollToSignup} />
      <Steps t={t} />
      <CardsSection t={t} />
      <WhySection t={t} />
      <SignupSection
        ref={signupRef}
        t={t}
        lang={lang}
        signupCount={signupCount}
        privacyHref={privacyHref}
        utmSource={utmSource}
        utmMedium={utmMedium}
      />
      <Faq t={t} />
      <Footer t={t} privacyHref={privacyHref} />
      <StickyMobileCta label={t.stickyCta} onClick={scrollToSignup} />
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: First20Lang; onChange: (l: First20Lang) => void }) {
  return (
    <div className="sticky top-0 z-40 flex justify-end gap-1 px-4 py-3 sm:px-8" style={{ backgroundColor: `${IVORY}f0` }}>
      {FIRST20_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className="rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors"
          style={{
            color: lang === l ? IVORY : FOREST,
            backgroundColor: lang === l ? FOREST : "transparent",
            border: `1px solid ${FOREST}`,
          }}
        >
          {first20T[l].langLabel}
        </button>
      ))}
    </div>
  );
}

function Hero({ t, onCtaClick }: { t: (typeof first20T)[First20Lang]; onCtaClick: () => void }) {
  const cards = t.cards.suits.slice(0, 3).map((s) => ({
    icon: FIRST20_SUIT_ICONS[s.icon as keyof typeof FIRST20_SUIT_ICONS],
    question: s.question,
  }));
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-5 pb-16 pt-6 text-center sm:gap-10 sm:pb-24">
      <span className="text-xs font-medium uppercase tracking-[0.25em]" style={{ color: BRONZE }}>
        {t.hero.eyebrow}
      </span>
      <HeroCards cards={cards} />
      <h1 className="font-serif text-3xl leading-tight sm:text-5xl" style={{ color: FOREST }}>
        {t.hero.title}
      </h1>
      <p className="max-w-md text-base leading-relaxed sm:text-lg" style={{ color: WALNUT }}>
        {t.hero.subtitle}
      </p>
      <button
        type="button"
        onClick={onCtaClick}
        className="rounded-full px-8 py-3.5 text-sm font-medium tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02]"
        style={{ backgroundColor: FOREST }}
      >
        {t.hero.cta}
      </button>
      <p className="text-xs" style={{ color: BRONZE }}>
        {t.hero.microline}
      </p>
    </section>
  );
}

function Steps({ t }: { t: (typeof first20T)[First20Lang] }) {
  return (
    <section className="px-5 py-16 sm:py-24" style={{ backgroundColor: FOREST }}>
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-10 text-center font-serif text-2xl sm:mb-14 sm:text-4xl" style={{ color: IVORY }}>
          {t.steps.title}
        </h2>
        <div className="flex flex-col gap-10 sm:flex-row sm:gap-8">
          {t.steps.items.map((step, i) => (
            <div key={i} className="flex-1 text-center sm:text-left">
              <span className="font-serif text-4xl" style={{ color: GOLD }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-serif text-xl" style={{ color: IVORY }}>
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#ddd3c4" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardsSection({ t }: { t: (typeof first20T)[First20Lang] }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <h2 className="mb-10 text-center font-serif text-2xl sm:mb-14 sm:text-4xl" style={{ color: FOREST }}>
        {t.cards.title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {t.cards.suits.map((suit) => {
          const Icon = FIRST20_SUIT_ICONS[suit.icon as keyof typeof FIRST20_SUIT_ICONS];
          return (
            <div
              key={suit.name}
              className="rounded-2xl border p-6"
              style={{ borderColor: "#ddd3c4", backgroundColor: "#faf8f3" }}
            >
              <Icon size={22} strokeWidth={1.5} color={BRONZE} />
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.15em]" style={{ color: BRONZE }}>
                {suit.name}
              </p>
              <p className="mt-2 font-serif text-lg leading-snug" style={{ color: FOREST }}>
                {suit.question}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mx-auto mt-10 max-w-xl text-center text-sm leading-relaxed" style={{ color: WALNUT }}>
        {t.cards.extra}
      </p>
    </section>
  );
}

function WhySection({ t }: { t: (typeof first20T)[First20Lang] }) {
  return (
    <section className="px-5 py-16 sm:py-24" style={{ backgroundColor: "#faf8f3" }}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-serif text-2xl sm:text-4xl" style={{ color: FOREST }}>
          {t.why.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: WALNUT }}>
          {t.why.body}
        </p>
        <div className="mx-auto mt-10 flex max-w-md flex-col gap-4 text-left sm:flex-row sm:gap-6">
          <div className="flex-1 rounded-2xl border p-5" style={{ borderColor: "#ddd3c4" }}>
            <p className="text-xs font-medium uppercase tracking-[0.15em]" style={{ color: BRONZE }}>
              {t.why.youGetLabel}
            </p>
            <p className="mt-1.5 font-serif text-lg" style={{ color: FOREST }}>
              {t.why.youGet}
            </p>
          </div>
          <div className="flex-1 rounded-2xl border p-5" style={{ borderColor: "#ddd3c4" }}>
            <p className="text-xs font-medium uppercase tracking-[0.15em]" style={{ color: BRONZE }}>
              {t.why.weAskLabel}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: WALNUT }}>
              {t.why.weAsk}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

type SignupStatus = "idle" | "submitting" | "success" | "already" | "error";

function SignupSection({
  ref,
  t,
  lang,
  signupCount,
  privacyHref,
  utmSource,
  utmMedium,
}: {
  ref: React.Ref<HTMLDivElement>;
  t: (typeof first20T)[First20Lang];
  lang: First20Lang;
  signupCount: number;
  privacyHref: string;
  utmSource: string | null;
  utmMedium: string | null;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(lang));
  const [status, setStatus] = useState<SignupStatus>("idle");
  const [errorKey, setErrorKey] = useState<keyof (typeof first20T)["de"]["signup"]["errors"] | null>(null);
  const prefersReducedMotion = useReducedMotion();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);

    if (!form.firstName.trim()) {
      setErrorKey("firstName");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrorKey("email");
      return;
    }
    if (!form.consent) {
      setErrorKey("consent");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/first20/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          email: form.email.trim(),
          partnerFirstName: form.partnerFirstName.trim() || undefined,
          languageChoice: form.languageChoice,
          howHeard: form.howHeard || undefined,
          consent: form.consent,
          utmSource: utmSource ?? undefined,
          utmMedium: utmMedium ?? undefined,
          website: form.website,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorKey((data.error as keyof (typeof first20T)["de"]["signup"]["errors"]) || "generic");
        setStatus("error");
        return;
      }
      setStatus(data.alreadyRegistered ? "already" : "success");
    } catch {
      setErrorKey("generic");
      setStatus("error");
    }
  }

  const showForm = status !== "success" && status !== "already";

  return (
    <section ref={ref} className="px-5 py-16 sm:py-24" style={{ backgroundColor: FOREST }}>
      <div className="mx-auto max-w-md">
        <h2 className="text-center font-serif text-2xl sm:text-4xl" style={{ color: IVORY }}>
          {t.signup.title}
        </h2>
        <p className="mt-3 text-center text-sm font-medium tracking-wide" style={{ color: GOLD }}>
          {signupCount > 0 ? t.signup.counter(signupCount) : t.signup.counterFallback}
        </p>

        {showForm ? (
          <motion.form
            onSubmit={submit}
            noValidate
            className="mt-8 flex flex-col gap-4"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Honeypot — hidden from real visitors, off-screen rather than
                display:none (some bots skip display:none fields). */}
            <div className="absolute left-[-9999px]" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </div>

            <Field label={t.signup.firstName} required>
              <input
                className="first20-input"
                required
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder={t.signup.firstNamePlaceholder}
              />
            </Field>
            <Field label={t.signup.email} required>
              <input
                type="email"
                className="first20-input"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder={t.signup.emailPlaceholder}
              />
            </Field>
            <Field label={t.signup.partnerFirstName}>
              <input
                className="first20-input"
                value={form.partnerFirstName}
                onChange={(e) => set("partnerFirstName", e.target.value)}
                placeholder={t.signup.partnerFirstNamePlaceholder}
              />
            </Field>
            <Field label={t.signup.languageQuestion}>
              <select
                className="first20-input"
                value={form.languageChoice}
                onChange={(e) => set("languageChoice", e.target.value as First20Lang)}
              >
                {FIRST20_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {t.signup.languageOptions[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.signup.howHeardQuestion}>
              <select
                className="first20-input"
                value={form.howHeard}
                onChange={(e) => set("howHeard", e.target.value as HowHeardOption)}
              >
                <option value="" />
                {HOW_HEARD_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {t.signup.howHeardOptions[o]}
                  </option>
                ))}
              </select>
            </Field>

            <label className="mt-2 flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: "#ddd3c4" }}>
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                {t.signup.consentPrefix}
                <Link href={privacyHref} className="underline" style={{ color: GOLD }}>
                  {t.signup.consentLinkText}
                </Link>
                {t.signup.consentSuffix}
              </span>
            </label>

            {errorKey && (
              <p className="text-xs" style={{ color: "#e8a7a7" }}>
                {t.signup.errors[errorKey]}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-2 rounded-full px-6 py-3.5 text-sm font-medium tracking-wide transition-opacity disabled:opacity-60"
              style={{ backgroundColor: GOLD, color: FOREST }}
            >
              {status === "submitting" ? t.signup.submitting : t.signup.submit}
            </button>
            <p className="mt-1 text-center text-xs leading-relaxed" style={{ color: "#ddd3c4" }}>
              {t.signup.footnote}
            </p>
          </motion.form>
        ) : (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-8 flex flex-col items-center gap-3 rounded-2xl border p-6 text-center"
            style={{ borderColor: GOLD }}
          >
            <Check size={28} color={GOLD} />
            <p className="text-sm leading-relaxed" style={{ color: IVORY }}>
              {status === "already" ? t.signup.alreadyRegistered : t.signup.success}
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium" style={{ color: "#ddd3c4" }}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function Faq({ t }: { t: (typeof first20T)[First20Lang] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <h2 className="mb-10 text-center font-serif text-2xl sm:text-4xl" style={{ color: FOREST }}>
        {t.faq.title}
      </h2>
      <div className="flex flex-col divide-y" style={{ borderColor: "#ddd3c4" }}>
        {t.faq.items.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={i} className="py-4" style={{ borderColor: "#ddd3c4" }}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="font-serif text-lg" style={{ color: FOREST }}>
                  {item.q}
                </span>
                <ChevronDown
                  size={18}
                  color={BRONZE}
                  style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                />
              </button>
              {open && (
                <p className="mt-2.5 text-sm leading-relaxed" style={{ color: WALNUT }}>
                  {item.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Footer({ t, privacyHref }: { t: (typeof first20T)[First20Lang]; privacyHref: string }) {
  const impressumHref = privacyHref.replace(/\/[^/]*$/, "/impresszum");
  return (
    <footer className="px-5 pb-28 pt-10 text-center sm:pb-10" style={{ backgroundColor: FOREST }}>
      <div className="flex items-center justify-center gap-1.5 text-sm" style={{ color: GOLD }}>
        <Sparkle size={14} />
        <span>{t.footer.tagline}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs" style={{ color: "#ddd3c4" }}>
        {/* TODO: valódi Instagram-link — nem találtam meglévő hivatkozást
            a kódbázisban, úgyhogy nem találtam ki egyet sem. Add meg a
            handle-t, és bekötöm. */}
        <span className="opacity-60">Instagram</span>
        <Link href={impressumHref} className="hover:underline">
          Impressum
        </Link>
        <Link href={privacyHref} className="hover:underline">
          Datenschutz
        </Link>
      </div>
    </footer>
  );
}

function StickyMobileCta({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:hidden" style={{ backgroundColor: `${IVORY}f5` }}>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-full px-6 py-3.5 text-sm font-medium tracking-wide text-white shadow-lg"
        style={{ backgroundColor: FOREST }}
      >
        {label}
      </button>
    </div>
  );
}
