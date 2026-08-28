"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, MapPin, Coffee, Moon, Camera, Mountain, Heart, Check } from "lucide-react";
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

  const supabase = getSupabaseClient();

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

  const completedCount = wildCards.length;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg text-forest">Személyes Journey (Passport)</h2>
          <p className="mt-1 text-sm text-muted">Emlékek és Wild Card kihívások — a közös úttok naplója.</p>
        </div>
        <button className="btn btn-bronze shrink-0" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Emlék hozzáadása
        </button>
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
        {loading ? (
          <Spinner />
        ) : memories.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Még nincs rögzített emlék — kezdd az elsővel.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
            {memories.map((memory) => (
              <li key={memory.id} className="relative">
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
    </section>
  );
}
