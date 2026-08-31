"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, MapPin, Coffee, Moon, Camera, Mountain, Heart, Check, History, PartyPopper, Printer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { JourneyMemory, WildCardCompletion, WildCardName } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import { formatDate } from "@/lib/format";

const STORAGE_BUCKET = "journey-memories";

const WILD_CARDS: { name: WildCardName; description: string; icon: LucideIcon }[] = [
  { name: "Coffee Break", description: "Igyatok meg együtt egy kávét, telefon nélkül.", icon: Coffee },
  { name: "Silence", description: "Töltsetek el 10 percet csendben, egymás mellett.", icon: Moon },
  { name: "Memory", description: "Idézzetek fel egy közös kedvenc emléket.", icon: Camera },
  { name: "Adventure", description: "Próbáljatok ki együtt valami újat.", icon: Mountain },
  { name: "Gratitude", description: "Mondjatok el egymásnak három dolgot, amiért hálásak vagytok.", icon: Heart },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { date: todayISO(), place: "", experience: "", note: "" };

// One-time dismissal of the "Évszak-zárás" card lives per-browser, same
// convention as the Naptár legend's category toggles — the 5 Wild Cards
// can't currently be un-completed, so there's no "next round" to reset it
// for; once acknowledged it just stays gone on that device.
const SEASON_CLOSING_DISMISS_KEY = "zusammen-wildcard-season-closing-dismissed";

/** Local-date (YYYY-MM-DD, no time component) parsed as UTC midnight so
 * month/year arithmetic below never drifts a day from a timezone or DST
 * transition — mirrors todayISO()'s own UTC-based "today". */
function isoDateToUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetweenUTC(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** "Ezen a napon" visszatekintés — the first memory (memories arrives
 * newest-first) landing within ±1 nap of exactly egy hónapja or egy éve.
 * Checked in list order so a more recent month-anniversary naturally wins
 * over an older year-anniversary when both happen to match. */
function findOnThisDayMemory(
  memories: JourneyMemory[]
): { memory: JourneyMemory; unit: "hónapja" | "éve" } | null {
  const today = isoDateToUTC(todayISO());
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);
  const oneYearAgo = new Date(today);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

  for (const memory of memories) {
    const memoryDate = isoDateToUTC(memory.date);
    if (Math.abs(daysBetweenUTC(memoryDate, oneMonthAgo)) <= 1) return { memory, unit: "hónapja" };
    if (Math.abs(daysBetweenUTC(memoryDate, oneYearAgo)) <= 1) return { memory, unit: "éve" };
  }
  return null;
}

export default function JourneyPassportSection({
  addedBy,
}: {
  /** See the same prop on GoldCardLettersSection — set from /together, undefined on the admin dashboard. */
  addedBy?: string;
}) {
  const [memories, setMemories] = useState<JourneyMemory[]>([]);
  const [wildCards, setWildCards] = useState<WildCardCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [completingCard, setCompletingCard] = useState<WildCardName | null>(null);
  // Briefly highlighted after "Ezen a napon" scrolls its target entry
  // into view, so the jump actually reads as landing somewhere specific.
  const [highlightedMemoryId, setHighlightedMemoryId] = useState<string | null>(null);
  const [seasonClosingDismissed, setSeasonClosingDismissed] = useState(false);

  const supabase = getSupabaseClient();

  // Read after mount only (never during the initial render) so this
  // never disagrees with the server-rendered markup — same reasoning as
  // every other per-browser localStorage read in this app.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeasonClosingDismissed(localStorage.getItem(SEASON_CLOSING_DISMISS_KEY) === "1");
    } catch {
      // Private browsing or a blocked localStorage — the card just won't
      // remember being dismissed across reloads on this device.
    }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [memoriesRes, wildCardsRes] = await Promise.all([
      supabase.from("journey_memories").select("*").order("date", { ascending: false }),
      supabase.from("wild_card_completions").select("*"),
    ]);
    if (memoriesRes.error) setError(memoriesRes.error.message);
    else if (wildCardsRes.error) setError(wildCardsRes.error.message);
    else {
      setMemories(memoriesRes.data ?? []);
      setWildCards(wildCardsRes.data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.place.trim() || !form.experience.trim()) {
      setError("Add meg a helyet és az élményt legalább.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let photoUrl: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      }

      const { data, error: insertError } = await supabase
        .from("journey_memories")
        .insert({
          date: form.date,
          place: form.place.trim(),
          experience: form.experience.trim(),
          note: form.note.trim() || null,
          photo_url: photoUrl,
          added_by: addedBy ?? null,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) setMemories((prev) => [data, ...prev]);
      setForm(EMPTY_FORM);
      setFile(null);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni az emléket.");
    } finally {
      setSaving(false);
    }
  }

  async function completeWildCard(name: WildCardName) {
    if (!supabase) return;
    setCompletingCard(name);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("wild_card_completions")
      .insert({ wildcard_name: name, completed_date: todayISO(), added_by: addedBy ?? null })
      .select()
      .single();
    setCompletingCard(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) setWildCards((prev) => [...prev, data]);
  }

  function dismissSeasonClosing() {
    setSeasonClosingDismissed(true);
    try {
      localStorage.setItem(SEASON_CLOSING_DISMISS_KEY, "1");
    } catch {
      // Nothing to persist to — it'll just show again on this device's
      // next visit, same fallback as the read above.
    }
  }

  function scrollToMemory(id: string) {
    document.getElementById(`journey-memory-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMemoryId(id);
    setTimeout(() => setHighlightedMemoryId((current) => (current === id ? null : current)), 2200);
  }

  const completedCount = wildCards.length;
  const onThisDay = useMemo(() => findOnThisDayMemory(memories), [memories]);
  // Nyomtatáshoz régiről az újra, mint egy elmesélhető történet — a
  // képernyőn látott lista (legújabb elöl) ehhez visszafelé menne.
  const printMemories = useMemo(
    () => [...memories].sort((a, b) => a.date.localeCompare(b.date)),
    [memories]
  );

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg text-forest">Személyes Journey (Passport)</h2>
          <p className="mt-1 text-sm text-muted">Emlékek és Wild Card kihívások — a közös úttok naplója.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="btn btn-ghost"
            onClick={() => window.print()}
            disabled={memories.length === 0}
            title={memories.length === 0 ? "Még nincs rögzített emlék" : "Emlékeink nyomtatása PDF-be"}
          >
            <Printer size={16} /> Emlékeink nyomtatása
          </button>
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Emlék hozzáadása
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 rounded-lg border border-border bg-ivory-dim/60 px-4 py-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-forest">{completedCount}/5 Wild Card teljesítve</span>
          <span className="text-muted">+ {memories.length} emlék rögzítve</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-bronze"
            style={{ width: `${(completedCount / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Évszak-zárás pillanat — shown once, the moment all 5 Wild Cards
          are complete; stays up until manually dismissed (no auto-hide,
          see SEASON_CLOSING_DISMISS_KEY above). */}
      {completedCount === 5 && !seasonClosingDismissed && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-bronze/40 bg-gradient-to-br from-amber-100 to-bronze-light/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="flex items-start gap-2.5">
            <PartyPopper size={18} className="mt-0.5 shrink-0 text-walnut" />
            <p className="text-sm text-walnut">
              Végigcsináltátok mind az 5 Wild Cardot ebben a körben — üljetek le pár percre, és
              beszéljétek meg: melyik volt a legváratlanabb élmény?
            </p>
          </div>
          <button className="btn btn-ghost shrink-0 self-end sm:self-auto" onClick={dismissSeasonClosing}>
            Elolvastam
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3 rounded-lg border border-border p-4 animate-fade-in">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Hely *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.place}
                onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
                placeholder="pl. Lauterbrunnen"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Élmény *</label>
              <input
                className="input"
                required
                value={form.experience}
                onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                placeholder="Mi történt?"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Jegyzet</label>
              <textarea
                className="textarea min-h-16"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Bármi, amit érdemes megőrizni erről a pillanatról…"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Fotó (opcionális)</label>
              <input
                type="file"
                accept="image/*"
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Emlék mentése"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {/* Wild Card grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {WILD_CARDS.map((card) => {
          const completion = wildCards.find((w) => w.wildcard_name === card.name);
          const Icon = card.icon;
          return (
            <div
              key={card.name}
              className={`flex flex-col gap-2 rounded-lg border p-3.5 ${
                completion ? "border-bronze/40 bg-bronze/5" : "border-border"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  completion ? "bg-bronze text-white" : "bg-forest/5 text-bronze"
                }`}
              >
                <Icon size={16} />
              </span>
              <p className="font-medium text-forest">{card.name}</p>
              <p className="text-xs text-muted">{card.description}</p>
              {completion ? (
                <span className="mt-auto flex items-center gap-1 text-xs font-medium text-bronze">
                  <Check size={13} /> {formatDate(completion.completed_date)}
                  {completion.added_by && ` · ${completion.added_by}`}
                </span>
              ) : (
                <button
                  className="btn btn-ghost mt-auto w-fit text-xs"
                  disabled={completingCard === card.name}
                  onClick={() => completeWildCard(card.name)}
                >
                  {completingCard === card.name ? "Mentés…" : "Teljesítve"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Memory timeline */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-forest">Emlék-napló</h3>

        {/* "Ezen a napon" visszatekintés — a Journey lista tetején, csak
            ha van pontosan 1 hónapja/éve (±1 nap) történt emlék. */}
        {onThisDay && (
          <button
            type="button"
            onClick={() => scrollToMemory(onThisDay.memory.id)}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-bronze/25 bg-bronze/10 px-3.5 py-2.5 text-left text-sm text-walnut transition-colors hover:bg-bronze/15"
          >
            <History size={15} className="shrink-0" />
            <span>
              Egy {onThisDay.unit} ezen a napon: <span className="font-medium">{onThisDay.memory.experience}</span>
            </span>
          </button>
        )}

        {loading ? (
          <Spinner />
        ) : memories.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Még nincs rögzített emlék — kezdd az elsővel.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
            {memories.map((memory) => (
              <li
                key={memory.id}
                id={`journey-memory-${memory.id}`}
                className={`relative -mx-2 rounded-md px-2 transition-colors duration-500 ${
                  highlightedMemoryId === memory.id ? "bg-bronze/10 ring-1 ring-bronze/30" : ""
                }`}
              >
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-bronze" />
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPin size={12} /> {memory.place} · {formatDate(memory.date)}
                  {memory.added_by && ` · ${memory.added_by}`}
                </div>
                <p className="mt-0.5 text-sm font-medium text-forest">{memory.experience}</p>
                {memory.note && <p className="mt-0.5 text-sm text-muted">{memory.note}</p>}
                {memory.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memory.photo_url}
                    alt={memory.experience}
                    className="mt-2 h-28 w-full max-w-xs rounded-lg object-cover"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Printable "Emlékeink" keepsake — hidden on screen, shown only via
          window.print() (see .print-journey / @media print in
          globals.css). Kept in normal DOM flow so it always reflects the
          current memories, same convention as the /landing print-letter
          keepsake ("Emlékeink nyomtatása" button above triggers it). */}
      <div className="print-journey" aria-hidden="true">
        <div className="print-journey-inner">
          <p className="print-journey-wordmark">ZUSAMMEN</p>
          <p className="print-journey-title">Közös Journey — Emlékeink</p>
          <div className="print-journey-divider" />
          {printMemories.length === 0 ? (
            <p className="print-journey-empty">Még nincs rögzített emlék.</p>
          ) : (
            printMemories.map((memory) => (
              <div key={memory.id} className="print-journey-entry">
                <p className="print-journey-meta">
                  {formatDate(memory.date)} · {memory.place}
                </p>
                <p className="print-journey-experience">{memory.experience}</p>
                {memory.note && <p className="print-journey-note">{memory.note}</p>}
                {memory.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={memory.photo_url} alt={memory.experience} className="print-journey-photo" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
