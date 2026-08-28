"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, KeyRound, Stamp, Pencil, Check } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { TogetherSettings } from "@/lib/supabase/types";
import {
  normalizeAccessCode,
  getStoredAccessCode,
  setStoredAccessCode,
  getStoredViewerName,
  setStoredViewerName,
} from "@/lib/together";
import { nextGoldCardDate, daysUntil } from "@/lib/gold-card";
import { formatDate } from "@/lib/format";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import GoldCardLettersSection from "@/components/GoldCardLettersSection";
import JourneyPassportSection from "@/components/JourneyPassportSection";
import SurpriseQuestionSection from "@/components/SurpriseQuestionSection";

type Phase = "loading" | "no-settings" | "gate-code" | "gate-name" | "shared";

const NAME_SUGGESTIONS = ["Barbara"];

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-forest px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center text-ivory">
          <HeartHandshake size={28} className="text-bronze" />
          <p className="font-serif text-xl">Közös tér</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}

export default function TogetherClient() {
  const searchParams = useSearchParams();
  const urlCode = searchParams.get("code");
  const supabase = getSupabaseClient();

  const [phase, setPhase] = useState<Phase>("loading");
  const [settings, setSettings] = useState<TogetherSettings | null>(null);

  const [codeInput, setCodeInput] = useState(urlCode ?? "");
  const [codeError, setCodeError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [viewerName, setViewerName] = useState<string | null>(null);

  const [sealedCount, setSealedCount] = useState(0);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("no-settings");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("together_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      setSettings(data ?? null);
      if (!data) {
        setPhase("no-settings");
        return;
      }

      const storedCode = getStoredAccessCode();
      const candidateCode = storedCode ?? (urlCode ? normalizeAccessCode(urlCode) : null);
      const storedName = getStoredViewerName();

      if (candidateCode && candidateCode === data.access_code) {
        setStoredAccessCode(candidateCode);
        if (storedName) {
          setViewerName(storedName);
          setPhase("shared");
        } else {
          setPhase("gate-name");
        }
      } else {
        setPhase("gate-code");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, urlCode]);

  const loadSealedCount = useCallback(async () => {
    if (!supabase) return;
    const { count } = await supabase.from("gold_card_letters").select("id", { count: "exact", head: true });
    setSealedCount(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    if (phase !== "shared") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSealedCount();
  }, [phase, loadSealedCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateInput(settings?.opening_date ?? "");
  }, [settings?.opening_date]);

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const normalized = normalizeAccessCode(codeInput);
    if (!normalized || normalized !== settings.access_code) {
      setCodeError("Helytelen kód — kérd el újra a linket.");
      return;
    }
    setCodeError(null);
    setStoredAccessCode(normalized);
    const storedName = getStoredViewerName();
    if (storedName) {
      setViewerName(storedName);
      setPhase("shared");
    } else {
      setPhase("gate-name");
    }
  }

  function confirmName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredViewerName(trimmed);
    setViewerName(trimmed);
    setPhase("shared");
  }

  async function saveOpeningDate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !settings) return;
    setSavingDate(true);
    const { data, error } = await supabase
      .from("together_settings")
      .update({ opening_date: dateInput || null })
      .eq("id", settings.id)
      .select()
      .single();
    setSavingDate(false);
    if (!error && data) {
      setSettings(data);
      setEditingDate(false);
    }
  }

  if (!isSupabaseConfigured || phase === "no-settings") {
    return (
      <GateShell>
        <p className="text-center text-sm text-muted">
          A közös tér linkje még nincs beállítva. Kérd meg, hogy generálja le a Dashboard Beállítások oldalán —
          onnan kapod meg a hozzáférési kódot és a linket.
        </p>
      </GateShell>
    );
  }

  if (phase === "loading") {
    return (
      <GateShell>
        <Spinner />
      </GateShell>
    );
  }

  if (phase === "gate-code") {
    return (
      <GateShell>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bronze/10 text-bronze">
            <KeyRound size={18} />
          </span>
          <p className="text-sm text-muted">Add meg a hozzáférési kódot, amit kaptál.</p>
        </div>
        <form onSubmit={submitCode} className="mt-4 flex flex-col gap-3">
          <input
            className="input text-center font-mono text-lg tracking-[0.3em] uppercase"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="XXXXXX"
            maxLength={12}
            autoFocus
          />
          {codeError && <ErrorBanner message={codeError} />}
          <button type="submit" className="btn btn-primary">
            Belépés
          </button>
        </form>
      </GateShell>
    );
  }

  if (phase === "gate-name") {
    return (
      <GateShell>
        <div className="text-center">
          <p className="font-serif text-lg text-forest">Ki vagy?</p>
          <p className="mt-1 text-sm text-muted">Ezt a böngésződ megjegyzi, legközelebb nem kérdezzük újra.</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {NAME_SUGGESTIONS.map((name) => (
            <button key={name} type="button" className="btn btn-bronze" onClick={() => confirmName(name)}>
              {name}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmName(nameInput);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            className="input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Partner neve"
          />
          <button type="submit" className="btn btn-ghost shrink-0" disabled={!nameInput.trim()}>
            Folytatás
          </button>
        </form>
      </GateShell>
    );
  }

  // phase === "shared" — settings is always set by the time we get here
  // (see the "no-settings" branch above), but keep the fallback narrow
  // rather than asserting it non-null throughout the JSX below.
  const openingDateStr = settings?.opening_date ?? null;
  const openingDate = openingDateStr ? new Date(`${openingDateStr}T00:00:00`) : null;
  const daysToOpening = openingDate ? daysUntil(openingDate, new Date()) : null;
  const filledSeals = sealedCount === 0 ? 0 : ((sealedCount - 1) % 4) + 1;
  const nextLetterDate = nextGoldCardDate(new Date());

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
        {/* Hero */}
        <section className="overflow-hidden rounded-2xl bg-forest px-6 py-8 text-ivory sm:px-10 sm:py-12">
          <p className="text-xs font-medium uppercase tracking-wide text-ivory/60">Szia, {viewerName}!</p>
          <h1 className="mt-2 font-serif text-2xl sm:text-3xl">A mi utunk a Café to Connect megnyitójáig</h1>

          {openingDate ? (
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-serif text-3xl">
                  {daysToOpening !== null && daysToOpening <= 0 ? "Ma van a nap! 🎉" : `${daysToOpening} nap a megnyitóig`}
                </p>
                <p className="mt-1 text-sm text-ivory/70">{formatDate(openingDateStr)}</p>
              </div>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                      i < filledSeals ? "border-bronze bg-bronze text-white" : "border-ivory/25 text-ivory/30"
                    }`}
                  >
                    <Stamp size={14} />
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-5 max-w-md text-sm italic text-ivory/70">
              A dátum még nincs kitűzve — de az út már elkezdődött.
            </p>
          )}

          {editingDate ? (
            <form onSubmit={saveOpeningDate} className="mt-5 flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="input w-auto bg-ivory text-forest"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
              <button type="submit" disabled={savingDate} className="btn btn-bronze">
                <Check size={15} /> {savingDate ? "Mentés…" : "Mentés"}
              </button>
              <button type="button" className="btn btn-ghost text-ivory" onClick={() => setEditingDate(false)}>
                Mégse
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="btn btn-ghost mt-5 text-ivory hover:bg-ivory/10"
              onClick={() => setEditingDate(true)}
            >
              <Pencil size={14} /> {openingDate ? "Dátum módosítása" : "Dátum kitűzése"}
            </button>
          )}

          <p className="mt-4 text-xs text-ivory/50">
            Következő Gold Card levél: {formatDate(nextLetterDate.toISOString())}
          </p>
        </section>

        {/* The 4 shared sections — same as the founder Dashboard's
            Személyes rituálé page, just reached without a login, and
            with "added_by" auto-filled from the viewer name above
            instead of asked by hand. */}
        <GoldCardLettersSection addedBy={viewerName ?? undefined} />
        <JourneyPassportSection addedBy={viewerName ?? undefined} />
        <SurpriseQuestionSection />
      </main>
    </div>
  );
}
