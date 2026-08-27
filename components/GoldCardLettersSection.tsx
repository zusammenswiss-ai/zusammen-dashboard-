"use client";

import { useCallback, useEffect, useState } from "react";
import { Stamp, Plus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { GoldCardLetter } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import { formatDate } from "@/lib/format";

const STORAGE_BUCKET = "gold-card-letters";

// First round is fixed to 2026-09-01, then every 3 months after that —
// per spec, independent of how many letters have actually been uploaded.
const GOLD_CARD_ANCHOR = new Date(2026, 8, 1); // month is 0-indexed: 8 = September

const RITUAL_QUESTIONS = [
  "Mit szeretünk most egymásban?",
  "Milyen közös álmot szeretnénk valóra váltani a következő évszakban?",
  "Mit ígérünk egymásnak?",
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextGoldCardDate(today: Date): Date {
  let next = startOfDay(GOLD_CARD_ANCHOR);
  const t = startOfDay(today);
  while (next.getTime() < t.getTime()) {
    next = new Date(next.getFullYear(), next.getMonth() + 3, next.getDate());
  }
  return next;
}

function daysUntil(date: Date, today: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { uploadedBy: "", sealedDate: todayISO() };

export default function GoldCardLettersSection() {
  const [letters, setLetters] = useState<GoldCardLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("gold_card_letters")
      .select("*")
      .order("seq_number", { ascending: false });
    if (error) setError(error.message);
    else setLetters(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.uploadedBy.trim() || !file) {
      setError("Add meg, ki tölti fel a levelet, és válassz egy fotót.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const photoUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

      const { data, error: insertError } = await supabase
        .from("gold_card_letters")
        .insert({
          seq_number: letters.length + 1,
          sealed_date: form.sealedDate,
          uploaded_by: form.uploadedBy.trim(),
          photo_url: photoUrl,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) setLetters((prev) => [data, ...prev]);
      setForm(EMPTY_FORM);
      setFile(null);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a levelet.");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date();
  const nextDate = nextGoldCardDate(today);
  const daysLeft = daysUntil(nextDate, today);
  // 4 seal icons per "year" of quarterly letters — fills up 1→4, then
  // starts refilling for the next year's set once a 5th letter arrives.
  const filledSeals = letters.length === 0 ? 0 : ((letters.length - 1) % 4) + 1;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg text-forest">Gold Card Letters</h2>
          <p className="mt-1 text-sm text-muted">Negyedévente egy lepecsételt levél — kettőtöknek, senki másnak.</p>
        </div>
        <button className="btn btn-bronze shrink-0" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Levél lepecsételése
        </button>
      </div>

      {/* Hero countdown + seal progress */}
      <div className="mt-5 flex flex-col gap-4 rounded-xl bg-forest px-5 py-5 text-ivory sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ivory/60">Következő levél</p>
          <p className="mt-1 font-serif text-2xl">
            {daysLeft <= 0 ? "Ma esedékes" : `${daysLeft} nap a következő levélig`}
          </p>
          <p className="mt-1 text-xs text-ivory/60">{formatDate(nextDate.toISOString())}</p>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                i < filledSeals
                  ? "border-bronze bg-bronze text-white"
                  : "border-ivory/25 bg-transparent text-ivory/30"
              }`}
            >
              <Stamp size={18} />
            </span>
          ))}
        </div>
      </div>

      {/* Ritual guide panel — always visible */}
      <div className="mt-5 rounded-lg border border-border bg-ivory-dim/60 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-bronze">Rituálé-útmutató</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-forest">
          {RITUAL_QUESTIONS.map((q) => (
            <li key={q} className="flex gap-2">
              <span className="text-bronze">•</span> {q}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3 rounded-lg border border-border p-4 animate-fade-in">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Ki tölti fel *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.uploadedBy}
                onChange={(e) => setForm((f) => ({ ...f, uploadedBy: e.target.value }))}
                placeholder="Név"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
              <input
                type="date"
                className="input"
                value={form.sealedDate}
                onChange={(e) => setForm((f) => ({ ...f, sealedDate: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Fotó a levélről *</label>
              <input
                type="file"
                accept="image/*"
                required
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted">
                A feltöltés után a fotó elmosva, lepecsételve jelenik meg — a levél tartalma marad titok.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Lepecsételés…" : "Levél lepecsételése"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : letters.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Még egy levél sincs lepecsételve — az első kör 2026.09.01-jén esedékes.</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {letters.map((letter) => (
            <div key={letter.id} className="overflow-hidden rounded-lg border border-border">
              <div className="relative h-36">
                <div
                  className="absolute inset-0 scale-110 bg-cover bg-center blur-md brightness-50"
                  style={{ backgroundImage: `url(${letter.photo_url})` }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ivory">
                  <Stamp size={26} />
                  <span className="text-xs font-semibold uppercase tracking-widest">Lepecsételve</span>
                </div>
              </div>
              <div className="px-3 py-2.5 text-xs text-muted">
                <span className="font-medium text-forest">#{letter.seq_number}</span> ·{" "}
                {formatDate(letter.sealed_date)} · {letter.uploaded_by}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
