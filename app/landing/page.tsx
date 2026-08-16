"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone, Sprout, Sun, Leaf, Snowflake } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { landingT, LANDING_SCREENS, type LandingLang, type LandingScreen } from "@/lib/landing-i18n";
import "./landing.css";

const SEASON_ICONS = { spring: Sprout, summer: Sun, autumn: Leaf, winter: Snowflake } as const;
const COMMUNITY_ICONS = { picnic: "🧺", "founding-circle": "🤝", opening: "☕" } as const;

export default function LandingPage() {
  const [lang, setLang] = useState<LandingLang>("de");
  const [screen, setScreen] = useState<LandingScreen>("hero");
  const [boxItems, setBoxItems] = useState<Set<string>>(new Set());
  const t = landingT[lang];

  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = prev;
    };
  }, [lang]);

  const screenIndex = LANDING_SCREENS.indexOf(screen);
  const progressPct = Math.round(((screenIndex + 1) / LANDING_SCREENS.length) * 100);

  function goTo(next: LandingScreen) {
    setScreen(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="landing-root">
      <div className="landing-overallbar">
        <div className="fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="lang-switch">
        <button className={lang === "de" ? "active" : ""} onClick={() => setLang("de")}>
          DE
        </button>
        <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
          EN
        </button>
      </div>

      <div className="landing-stage">
        {screen === "hero" && <HeroScreen t={t} onStory={() => goTo("story")} onSkip={() => goTo("card")} />}
        {screen === "story" && <StoryScreen t={t} onNext={() => goTo("card")} />}
        {screen === "card" && <CardScreen t={t} onDone={() => goTo("letter")} />}
        {screen === "letter" && (
          <LetterScreen t={t} lang={lang} onNext={() => goTo("box")} />
        )}
        {screen === "box" && (
          <BoxScreen t={t} selected={boxItems} onToggle={setBoxItems} onNext={() => goTo("seasons")} />
        )}
        {screen === "seasons" && <SeasonsScreen t={t} onNext={() => goTo("community")} />}
        {screen === "community" && <CommunityScreen t={t} onNext={() => goTo("survey")} />}
        {screen === "survey" && (
          <SurveyScreen t={t} lang={lang} boxItems={boxItems} onDone={() => goTo("thanks")} />
        )}
        {screen === "thanks" && <ThanksScreen t={t} />}
      </div>

      <FounderLink t={t} />
    </div>
  );
}

function LandingMark({ size = 72 }: { size?: number }) {
  return (
    <svg
      className="landing-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill="#233328" />
      <path d="M22 66 L40 36 L52 54 L60 42 L78 66 Z" fill="#F3EFE7" opacity="0.95" />
      <path
        d="M50 48 C50 44 46 42 43 44.5 C40.5 46.5 40.5 50 43 52.5 L50 59 L57 52.5 C59.5 50 59.5 46.5 57 44.5 C54 42 50 44 50 48 Z"
        fill="#C8A96B"
      />
    </svg>
  );
}

function SignatureMark() {
  return (
    <span
      className="sigmark"
      style={{
        borderRadius: "50%",
        background: "var(--l-gold)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--l-display)",
        fontWeight: 600,
        color: "var(--l-forest)",
      }}
    >
      Z
    </span>
  );
}

type T = (typeof landingT)["de"];

function HeroScreen({ t, onStory, onSkip }: { t: T; onStory: () => void; onSkip: () => void }) {
  return (
    <div className="landing-hero">
      <p className="landing-eyebrow">{t.hero.eyebrow}</p>
      <LandingMark />
      <p className="sub">{t.hero.sub}</p>
      <p>{t.hero.intro}</p>

      <div className="phonefree">
        <Smartphone size={34} strokeWidth={1.4} color="#F3EFE7" />
        <p>
          <strong>{t.hero.phoneTitle}</strong>
          {t.hero.phoneBody}
        </p>
      </div>

      <p className="landing-timenote">{t.hero.timenote}</p>
      <button className="landing-btn" onClick={onStory}>
        {t.hero.storyButton}
      </button>
      <div>
        <button className="storylink" onClick={onSkip}>
          {t.hero.skipLink}
        </button>
      </div>
    </div>
  );
}

function StoryScreen({ t, onNext }: { t: T; onNext: () => void }) {
  const s = t.story;
  return (
    <div className="storyscreen">
      <p className="landing-eyebrow">{s.eyebrow}</p>
      <h2>{s.title}</h2>
      <p className="pullq">{s.pullq}</p>
      <p>{s.p1}</p>
      <div className="linegroup">
        {s.lines1.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <p>{s.p2}</p>
      <p>{s.p3}</p>
      <p>{s.p4}</p>
      <div className="linegroup">
        {s.lines2.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <h3>{s.h3}</h3>
      <p>{s.p5}</p>
      <p>{s.p6}</p>
      <p>{s.p7}</p>
      <p>{s.p8}</p>
      <p className="emph">{s.emph}</p>
      <p>{s.p9}</p>
      <p>{s.p10}</p>
      <p>{s.p11}</p>
      <p>{s.p12}</p>
      <p>{s.p13}</p>
      <p>{s.p14}</p>
      <p>{s.p15}</p>
      <p>{s.p16}</p>
      <p>{s.p17}</p>
      <p>{s.p18}</p>
      <p className="emphgreen">{s.emphgreen}</p>
      <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--l-walnut)" }}>{s.closing}</p>

      <div className="signature" style={{ justifyContent: "center" }}>
        <SignatureMark />
        <span className="sigtext">
          — Barbara
          <span className="role">{s.signatureRole}</span>
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <button className="landing-btn" onClick={onNext}>
          {s.cta}
        </button>
      </div>
    </div>
  );
}

function CardScreen({ t, onDone }: { t: T; onDone: () => void }) {
  const [pos, setPos] = useState(0);
  const deck = t.card.deck;
  const item = deck[pos];
  const isLast = pos === deck.length - 1;

  return (
    <div className="card-view">
      <div className="landing-progress">
        {pos + 1} / {deck.length}
      </div>
      {item.type === "suit" ? (
        <div className="landing-card">
          <div className="question">{item.q}</div>
        </div>
      ) : (
        <div className="landing-card wild">
          <div className="wicon">{item.icon}</div>
          <div className="wname">{item.name}</div>
          <div className="wtag">{item.tag}</div>
          <div className="wtask">{item.task}</div>
        </div>
      )}
      <div className="card-actions">
        <button
          className="landing-btn"
          onClick={() => (isLast ? onDone() : setPos((p) => p + 1))}
        >
          {isLast ? t.card.drawLast : t.card.drawNext}
        </button>
      </div>
    </div>
  );
}

function LetterScreen({ t, lang, onNext }: { t: T; lang: LandingLang; onNext: () => void }) {
  const [text, setText] = useState("");

  async function submit() {
    const trimmed = text.trim();
    if (trimmed) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase
          .from("landing_letters")
          .insert({ letter_text: trimmed, lang });
        if (error) console.error(error);
      }
    }
    onNext();
  }

  return (
    <div className="letterscreen">
      <div className="goldcard">
        <div className="seal">✦</div>
        <div className="gtitle">{t.letter.goldTitle}</div>
        <div className="gprompt">{t.letter.goldPrompt}</div>
      </div>
      <p className="context">{t.letter.context}</p>
      <p
        style={{
          fontFamily: "var(--l-display)",
          fontStyle: "italic",
          fontSize: 17,
          color: "var(--l-forest)",
          marginBottom: 14,
        }}
      >
        {t.letter.question}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.letter.placeholder}
      />
      <p className="privacy">{t.letter.privacy}</p>
      <button className="landing-btn gold" onClick={submit}>
        {t.letter.cta}
      </button>
    </div>
  );
}

function BoxScreen({
  t,
  selected,
  onToggle,
  onNext,
}: {
  t: T;
  selected: Set<string>;
  onToggle: (next: Set<string>) => void;
  onNext: () => void;
}) {
  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onToggle(next);
  }

  return (
    <div className="boxscreen">
      <h2>{t.box.title}</h2>
      <p className="lead">{t.box.lead}</p>
      <div className="boxgrid">
        {t.box.items.map((item) => {
          const isSelected = "locked" in item && item.locked ? true : selected.has(item.key);
          const locked = "locked" in item && item.locked;
          return (
            <div
              key={item.key}
              className={`boxitem ${isSelected ? "selected" : ""} ${locked ? "locked" : ""}`}
              onClick={locked ? undefined : () => toggle(item.key)}
            >
              <div className="check">{isSelected ? "✓" : ""}</div>
              <div className="txt">
                <strong>{item.name}</strong>
                <span>{item.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
      <button className="landing-btn gold" onClick={onNext}>
        {t.box.cta}
      </button>
    </div>
  );
}

function SeasonsScreen({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <div className="seasonsscreen">
      <p className="landing-eyebrow">{t.seasons.eyebrow}</p>
      <h2>{t.seasons.title}</h2>
      <p>{t.seasons.intro}</p>
      <div className="seasongrid">
        {t.seasons.cards.map((c) => {
          const Icon = SEASON_ICONS[c.key as keyof typeof SEASON_ICONS];
          return (
            <div key={c.key} className="seasoncard">
              <Icon color="#7A5A3B" strokeWidth={1.4} />
              <strong>{c.title}</strong>
              <span>{c.desc}</span>
            </div>
          );
        })}
      </div>
      <div className="journeybox">
        <p className="jeyebrow">{t.seasons.journeyEyebrow}</p>
        <p>{t.seasons.journeyP1}</p>
        <p>{t.seasons.journeyP2}</p>
      </div>
      <div style={{ textAlign: "center", marginTop: 26 }}>
        <button className="landing-btn gold" onClick={onNext}>
          {t.seasons.cta}
        </button>
      </div>
    </div>
  );
}

function CommunityScreen({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <div className="communityscreen">
      <p className="landing-eyebrow">{t.community.eyebrow}</p>
      <h2>{t.community.title}</h2>
      <p>{t.community.intro}</p>
      <div className="commlist">
        {t.community.items.map((item) => (
          <div key={item.key} className="commitem">
            <span className="cicon">{COMMUNITY_ICONS[item.key as keyof typeof COMMUNITY_ICONS]}</span>
            <div>
              <strong>{item.name}</strong>
              <span>{item.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="landing-btn gold" onClick={onNext}>
        {t.community.cta}
      </button>
    </div>
  );
}

function SurveyScreen({
  t,
  lang,
  boxItems,
  onDone,
}: {
  t: T;
  lang: LandingLang;
  boxItems: Set<string>;
  onDone: () => void;
}) {
  const [wouldBuy, setWouldBuy] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [email, setEmail] = useState("");

  async function submit() {
    if (!wouldBuy || !price) {
      alert(t.survey.alertIncomplete);
      return;
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from("landing_responses").insert({
        would_buy: wouldBuy,
        price_range: price,
        idea: idea.trim() || null,
        email: email.trim() || null,
        box_items: Array.from(boxItems),
        lang,
      });
      if (error) console.error(error);
    }
    onDone();
  }

  return (
    <div className="landing-survey">
      <h2>{t.survey.title}</h2>
      <p className="lead">{t.survey.lead}</p>

      <div className="qblock">
        <label className="qlabel">{t.survey.q1Label}</label>
        <div className="landing-options">
          {t.survey.q1Options.map((opt) => (
            <div
              key={opt}
              className={`landing-opt ${wouldBuy === opt ? "selected" : ""}`}
              onClick={() => setWouldBuy(opt)}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>

      <div className="qblock">
        <label className="qlabel">{t.survey.q2Label}</label>
        <div className="landing-options">
          {t.survey.q2Options.map((opt) => (
            <div
              key={opt}
              className={`landing-opt ${price === opt ? "selected" : ""}`}
              onClick={() => setPrice(opt)}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>

      <div className="qblock">
        <label className="qlabel">{t.survey.q3Label}</label>
        <span className="hint">{t.survey.q3Hint}</span>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={t.survey.q3Placeholder}
        />
      </div>

      <div className="qblock">
        <label className="qlabel">{t.survey.emailLabel}</label>
        <div className="emailrow">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.survey.emailPlaceholder}
          />
        </div>
      </div>

      <button className="landing-btn gold" onClick={submit}>
        {t.survey.submit}
      </button>
    </div>
  );
}

function ThanksScreen({ t }: { t: T }) {
  const [others, setOthers] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) setOthers([]);
        return;
      }
      const { data, error } = await supabase
        .from("landing_letters")
        .select("letter_text")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error || !data) {
        setOthers([]);
        return;
      }
      const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 4);
      setOthers(shuffled.map((r) => r.letter_text));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing-thanks">
      <h2 style={{ textAlign: "center" }}>{t.thanks.title}</h2>
      <p style={{ textAlign: "center" }}>{t.thanks.subtitle}</p>
      <div className="landing-others">
        <h3>{t.thanks.othersHeading}</h3>
        {others === null ? (
          <p style={{ textAlign: "center", fontSize: 13.5, color: "#777" }}>{t.thanks.loading}</p>
        ) : others.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 13.5, color: "#777" }}>{t.thanks.firstMessage}</p>
        ) : (
          others.map((text, i) => (
            <div key={i} className="landing-quote">
              “{text}”
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type FounderStats = {
  totalResponses: number;
  letterCount: number;
  emails: number;
  buyCounts: Record<string, number>;
  priceCounts: Record<string, number>;
  boxCounts: Record<string, number>;
  ideas: string[];
};

function FounderLink({ t }: { t: T }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<FounderStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const passwordEntered = useRef(false);

  const load = useCallback(async () => {
    setStats(null);
    setError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError(t.founder.loadError);
      return;
    }
    const [responsesRes, lettersRes] = await Promise.all([
      supabase.from("landing_responses").select("*"),
      supabase.from("landing_letters").select("id"),
    ]);
    if (responsesRes.error) {
      setError(t.founder.loadError);
      return;
    }
    const records = responsesRes.data ?? [];
    const letterCount = lettersRes.data?.length ?? 0;
    const buyCounts: Record<string, number> = {};
    const priceCounts: Record<string, number> = {};
    const boxCounts: Record<string, number> = {};
    let emails = 0;
    const ideas: string[] = [];
    records.forEach((r) => {
      if (r.would_buy) buyCounts[r.would_buy] = (buyCounts[r.would_buy] ?? 0) + 1;
      if (r.price_range) priceCounts[r.price_range] = (priceCounts[r.price_range] ?? 0) + 1;
      if (r.email) emails++;
      if (r.idea) ideas.push(r.idea);
      (r.box_items ?? []).forEach((b: string) => {
        boxCounts[b] = (boxCounts[b] ?? 0) + 1;
      });
    });
    setStats({ totalResponses: records.length, letterCount, emails, buyCounts, priceCounts, boxCounts, ideas });
  }, [t.founder.loadError]);

  function handleClick() {
    if (!passwordEntered.current) {
      const pw = prompt(t.founder.passwordPrompt);
      if (pw !== "zusammen2026") {
        if (pw !== null) alert(t.founder.wrongPassword);
        return;
      }
      passwordEntered.current = true;
    }
    setOpen(true);
    void load();
  }

  return (
    <>
      <button className="founderlink" onClick={handleClick}>
        {t.founder.link}
      </button>
      {open && (
        <div className="foundermodal" onClick={() => setOpen(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <h3>{t.founder.modalTitle}</h3>
            {error ? (
              <p>{error}</p>
            ) : !stats ? (
              <p>{t.founder.loading}</p>
            ) : stats.totalResponses === 0 && stats.letterCount === 0 ? (
              <p>{t.founder.noResponses}</p>
            ) : (
              <div>
                <div className="statrow">
                  <strong>{t.founder.totalResponses}</strong>
                  <span>{stats.totalResponses}</span>
                </div>
                <div className="statrow">
                  <strong>{t.founder.lettersWritten}</strong>
                  <span>{stats.letterCount}</span>
                </div>
                <div className="statrow">
                  <strong>{t.founder.emailsProvided}</strong>
                  <span>{stats.emails}</span>
                </div>
                <p style={{ marginTop: 14, fontWeight: 600 }}>{t.founder.wouldBuy}</p>
                {Object.entries(stats.buyCounts).map(([k, v]) => (
                  <div className="statrow" key={k}>
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
                <p style={{ marginTop: 14, fontWeight: 600 }}>{t.founder.priceSensitivity}</p>
                {Object.entries(stats.priceCounts).map(([k, v]) => (
                  <div className="statrow" key={k}>
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
                {Object.keys(stats.boxCounts).length > 0 && (
                  <>
                    <p style={{ marginTop: 14, fontWeight: 600 }}>{t.founder.boxWishes}</p>
                    {Object.entries(stats.boxCounts).map(([k, v]) => (
                      <div className="statrow" key={k}>
                        <span>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </>
                )}
                {stats.ideas.length > 0 && (
                  <>
                    <p style={{ marginTop: 14, fontWeight: 600 }}>{t.founder.ideasWritten}</p>
                    {stats.ideas.map((idea, i) => (
                      <div className="ideatext" key={i}>
                        {idea}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            <button
              className="landing-btn outline"
              style={{ marginTop: 18, width: "100%" }}
              onClick={() => setOpen(false)}
            >
              {t.founder.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
