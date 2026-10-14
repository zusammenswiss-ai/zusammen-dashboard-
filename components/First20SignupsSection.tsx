"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, Copy, Check, ExternalLink, Trash2, Mail, MailCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup } from "@/lib/supabase/types";
import { first20T, type First20Lang, type HowHeardOption } from "@/lib/first20-i18n";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import ShowMoreButton from "@/components/ShowMoreButton";
import { useShowMore } from "@/lib/useShowMore";
import { formatDate } from "@/lib/format";

const TOTAL_SPOTS = 20;

const LANG_LABEL: Record<First20Lang, string> = { hu: "Magyar", de: "Német", en: "Angol" };
const LANG_BADGE: Record<First20Lang, string> = {
  hu: "bg-forest/10 text-forest",
  de: "bg-bronze/15 text-walnut",
  en: "bg-teal/10 text-teal",
};

// Dashboardon mindig magyarul mutatjuk a "honnan hallottatok róla" választ,
// függetlenül attól, hogy a jelentkező melyik nyelven töltötte ki a formot.
const HOW_HEARD_LABEL_HU = first20T.hu.signup.howHeardOptions;

function shareUrl(origin: string, lang: First20Lang): string {
  return lang === "de" ? `${origin}/first20` : `${origin}/first20?lang=${lang}`;
}

/** "First 20" kampány — a /first20 publikus oldal élő jelentkezésszámlálója,
 * a megosztható link, és a beérkezett jelentkezések listája, hogy ne kelljen
 * külön a Supabase-be nézni ahhoz, hogy lássuk, ki és hogyan jelentkezett. */
export default function First20SignupsSection() {
  const [signups, setSignups] = useState<First20Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<First20Lang>("de");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("first20_signups")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setSignups(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    if (supabase) void load();
  }, [supabase, load]);

  const { visible, hiddenCount, showAll, setShowAll } = useShowMore(signups, 8);
  const url = origin ? shareUrl(origin, lang) : "";

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API lehet nem elérhető — a link mezőben akkor is látható és kijelölhető.
    }
  }

  async function deleteSignup(id: string) {
    if (!supabase) return;
    setSignups((prev) => prev.filter((s) => s.id !== id));
    const { error: deleteError } = await supabase.from("first20_signups").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">First 20 — megosztható link</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          A publikus /first20 jelentkezési oldal linkje — nyelvválasztóval, hogy a megfelelő verziót küldd tovább.
        </p>

        <div className="mt-4 flex gap-2">
          {(["de", "hu", "en"] as First20Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`badge cursor-pointer border ${
                lang === l ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
              }`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Link</label>
            <input className="input font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={copyLink} className="btn btn-primary" disabled={!url}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Másolva" : "Link másolása"}
            </button>
            <a
              href={url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn btn-ghost ${url ? "" : "pointer-events-none opacity-50"}`}
            >
              <ExternalLink size={15} /> Megnyitás
            </a>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg text-forest">Jelentkezések</h2>
          <span className="badge bg-ivory-dim text-walnut">
            {signups.length} / {TOTAL_SPOTS} hely foglalt
          </span>
        </div>

        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}

        {loading ? (
          <div className="mt-4">
            <Spinner />
          </div>
        ) : signups.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Rocket}
              title="Még nincs jelentkezés"
              description="Amint valaki kitölti a /first20 oldalt, itt fog megjelenni."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-1.5">
              {visible.map((s) => (
                <SignupRow key={s.id} signup={s} onDelete={() => deleteSignup(s.id)} />
              ))}
            </div>
            {signups.length > 8 && (
              <div className="mt-2">
                <ShowMoreButton hiddenCount={hiddenCount} showAll={showAll} onToggle={() => setShowAll((v) => !v)} />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function SignupRow({ signup, onDelete }: { signup: First20Signup; onDelete: () => void }) {
  const howHeardLabel = signup.how_heard
    ? HOW_HEARD_LABEL_HU[signup.how_heard as HowHeardOption] ?? signup.how_heard
    : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium text-forest">
          {signup.first_name}
          {signup.partner_first_name && ` & ${signup.partner_first_name}`}
        </span>
        <a href={`mailto:${signup.email}`} className="ml-1.5 text-xs text-muted hover:underline">
          {signup.email}
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`badge ${LANG_BADGE[signup.language_choice]}`}>{LANG_LABEL[signup.language_choice]}</span>
          {howHeardLabel && <span className="badge bg-ivory-dim text-walnut">{howHeardLabel}</span>}
          {signup.confirmation_email_sent ? (
            <span className="flex items-center gap-1 text-[11px] text-muted" title="Visszaigazoló email elküldve">
              <MailCheck size={12} /> email elküldve
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted/60" title="Visszaigazoló email nem ment ki">
              <Mail size={12} /> nincs visszaigazolás
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted">{formatDate(signup.created_at)}</span>
        <button onClick={onDelete} className="text-muted/70 hover:text-red-600" title="Törlés">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
