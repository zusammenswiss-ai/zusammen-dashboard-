"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, Copy, Check, ExternalLink, Trash2, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, Campaign } from "@/lib/supabase/types";
import { first20T, type First20Lang, type HowHeardOption } from "@/lib/first20-i18n";
import { FIRST20_DISPLAY_STATUS_STYLES, deriveFirst20DisplayStatus } from "@/lib/first20-signup-status";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import ShowMoreButton from "@/components/ShowMoreButton";
import SignupDetailModal from "@/components/campaign/signup/SignupDetailModal";
import { useShowMore } from "@/lib/useShowMore";
import { formatDate } from "@/lib/format";

const TOTAL_SPOTS = 20;
const DOCUMENTS_BUCKET = "documents";

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
 * külön a Supabase-be nézni ahhoz, hogy lássuk, ki és hogyan jelentkezett.
 *
 * Egy sorra kattintva megnyílik a jelentkező teljes részletnézete
 * (SignupDetailModal) — ott él az e-mail küldés, a visszajelzés/rendelés,
 * a dokumentumok, a feladatok és a jegyzetek. A lista maga csak a
 * tényleges levélállapotot (lib/first20-signup-status.ts) és egy
 * törlés-gyorsikont mutatja. */
export default function First20SignupsSection({
  campaign,
  onCampaignUpdated,
  openSignupId,
  onSignupOpened,
}: {
  campaign: Campaign;
  onCampaignUpdated: (campaign: Campaign) => void;
  /** /marketing/kampanyok/[slug]?signup=<id> deep linkhez — a Feladatok
   * Kanban-kártya jelentkező-badge-je nyit meg innen egy jelentkezőt. */
  openSignupId?: string | null;
  onSignupOpened?: () => void;
}) {
  const [signups, setSignups] = useState<First20Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<First20Lang>("de");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);
  const [autoSendSaving, setAutoSendSaving] = useState(false);

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
    fetch("/api/mail/send-status")
      .then((res) => res.json())
      .then((data) => setMailConfigured(data.configured))
      .catch(() => setMailConfigured(false));
  }, [supabase, load]);

  useEffect(() => {
    if (openSignupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenId(openSignupId);
      onSignupOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignupId]);

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

  async function toggleAutoSend() {
    if (!supabase) return;
    setAutoSendSaving(true);
    const { data, error: updateError } = await supabase
      .from("campaigns")
      .update({ first20_auto_send: !campaign.first20_auto_send })
      .eq("id", campaign.id)
      .select()
      .single();
    setAutoSendSaving(false);
    if (updateError) setError(updateError.message);
    else if (data) onCampaignUpdated(data);
  }

  async function deleteSignup(signup: First20Signup) {
    if (!supabase) return;
    if (
      !window.confirm(
        `Biztosan törlöd "${signup.first_name}" jelentkezését? Az összes hozzá tartozó e-mail-napló, jegyzet és dokumentum is törlődik. Ez nem vonható vissza.`
      )
    ) {
      return;
    }
    // A dokumentumok Storage-fájljait explicit törölni kell a sor
    // törlése előtt — a DB-sor cascade-del törlődik, de a Storage-ban
    // lévő fájlt ez nem érinti (lásd supabase/schema.sql kommentjét).
    const { data: docs } = await supabase.from("documents").select("file_path").eq("signup_id", signup.id);
    const paths = (docs ?? []).map((d) => d.file_path).filter((p): p is string => !!p);
    if (paths.length > 0) await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);

    setSignups((prev) => prev.filter((s) => s.id !== signup.id));
    const { error: deleteError } = await supabase.from("first20_signups").delete().eq("id", signup.id);
    if (deleteError) setError(deleteError.message);
  }

  return (
    <div className="flex flex-col gap-5">
      {mailConfigured === false && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Nincs küldésre kész postafiók — állíts be egyet a Postafiók → Fiókok fülön, addig az e-mail küldés ki van kapcsolva. Egy
            jelentkező megnyitásakor a sablon-előnézet attól is működik.
          </span>
        </div>
      )}

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Rocket size={18} className="text-bronze" />
            <h2 className="font-serif text-lg text-forest">First 20 — megosztható link</h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={campaign.first20_auto_send} disabled={autoSendSaving} onChange={toggleAutoSend} />
            Automatikus küldés (napi cron: emlékeztető + visszajelzés kérése)
          </label>
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
                <SignupRow key={s.id} signup={s} onOpen={() => setOpenId(s.id)} onDelete={() => deleteSignup(s)} />
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

      {openId && (
        <SignupDetailModal signupId={openId} campaignId={campaign.id} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}

function SignupRow({
  signup,
  onOpen,
  onDelete,
}: {
  signup: First20Signup;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const howHeardLabel = signup.how_heard
    ? HOW_HEARD_LABEL_HU[signup.how_heard as HowHeardOption] ?? signup.how_heard
    : null;
  const displayStatus = deriveFirst20DisplayStatus(signup);

  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-bronze/50 hover:bg-ivory-dim/50"
    >
      <div className="min-w-0">
        <span className="font-medium text-forest">
          {signup.first_name}
          {signup.partner_first_name && ` & ${signup.partner_first_name}`}
        </span>
        <a
          href={`mailto:${signup.email}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-1.5 text-xs text-muted hover:underline"
        >
          {signup.email}
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`badge ${LANG_BADGE[signup.language_choice]}`}>{LANG_LABEL[signup.language_choice]}</span>
          {howHeardLabel && <span className="badge bg-ivory-dim text-walnut">{howHeardLabel}</span>}
          <span className={`badge ${FIRST20_DISPLAY_STATUS_STYLES[displayStatus]}`}>{displayStatus}</span>
          {signup.email_error && (
            <span className="badge bg-red-100 text-red-700" title={signup.email_error}>
              <AlertTriangle size={11} /> Hiba
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted">{formatDate(signup.created_at)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted/70 hover:text-red-600"
          title="Törlés"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
