"use client";

import { useEffect, useRef, useState } from "react";
import { Shuffle, Copy, Check, TriangleAlert } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  SURPRISE_QUESTIONS,
  SURPRISE_WARNING,
  SURPRISE_SIGNATURE,
  drawRandomQuestion,
  buildShareText,
} from "@/lib/surprise-questions";

const SHUFFLE_DURATION_MS = 1500;
const SHUFFLE_TICK_MS = 80;

type DrawResult = { intro: string; question: string; outro: string };

export default function SurpriseQuestionSection() {
  const [shuffling, setShuffling] = useState(false);
  const [shuffleText, setShuffleText] = useState(SURPRISE_QUESTIONS[0]);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = getSupabaseClient();

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  async function logDraw(questionText: string) {
    if (!supabase) return;
    await supabase.from("surprise_question_log").insert({ question_text: questionText });
  }

  function draw() {
    setResult(null);
    setCopied(false);
    setShuffling(true);
    intervalRef.current = setInterval(() => {
      setShuffleText(SURPRISE_QUESTIONS[Math.floor(Math.random() * SURPRISE_QUESTIONS.length)]);
    }, SHUFFLE_TICK_MS);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const drawn = drawRandomQuestion();
      setResult(drawn);
      setShuffling(false);
      void logDraw(drawn.question);
    }, SHUFFLE_DURATION_MS);
  }

  async function copyToClipboard() {
    if (!result) return;
    const text = buildShareText(result.intro, result.question, result.outro);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) —
      // fail silently rather than throwing, the text is still visible to
      // select and copy manually.
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-serif text-lg text-forest">Meglepetés kérdés</h2>
      <p className="mt-1 text-sm text-muted">Húzz egy lapot a 58 kérdésből, és küldd el neki.</p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-bronze/30 bg-bronze/5 px-4 py-3 text-sm text-walnut">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>{SURPRISE_WARNING}</span>
      </div>

      <div className="mt-5 flex flex-col items-center gap-5 rounded-xl border border-border bg-ivory-dim/60 px-5 py-8 text-center">
        {shuffling ? (
          <p className="max-w-md font-serif text-lg text-forest/60 transition-opacity">{shuffleText}</p>
        ) : result ? (
          <div className="flex max-w-md flex-col gap-3 animate-fade-in">
            <p className="text-sm text-muted">{result.intro}</p>
            <p className="font-serif text-xl text-forest">{result.question}</p>
            <p className="text-sm text-muted">{result.outro}</p>
            <p className="text-sm font-medium text-bronze">{SURPRISE_SIGNATURE}</p>
          </div>
        ) : (
          <p className="max-w-md text-sm text-muted">Nyomj a gombra, és 58 kérdés közül keverünk egyet neked.</p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-bronze" onClick={draw} disabled={shuffling}>
            <Shuffle size={16} /> {shuffling ? "Keverés…" : "Húzz egy lapot"}
          </button>
          {result && (
            <button className="btn btn-ghost" onClick={copyToClipboard}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Másolva" : "Másolás küldéshez"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
