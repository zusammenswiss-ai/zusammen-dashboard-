"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup } from "@/lib/supabase/types";
import { first20T, type HowHeardOption } from "@/lib/first20-i18n";
import { FIRST20_STATUSES } from "@/lib/labels";
import { FIRST20_DISPLAY_STATUS_STYLES, deriveFirst20DisplayStatus } from "@/lib/first20-signup-status";
import { formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import { ErrorBanner } from "@/components/Feedback";

const LANG_LABEL = { hu: "Magyar", de: "Német", en: "Angol" } as const;
const HOW_HEARD_LABEL_HU = first20T.hu.signup.howHeardOptions;

export default function SignupOverviewTab({
  signup,
  onUpdated,
}: {
  signup: First20Signup;
  onUpdated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const howHeardLabel = signup.how_heard ? HOW_HEARD_LABEL_HU[signup.how_heard as HowHeardOption] ?? signup.how_heard : null;
  const displayStatus = deriveFirst20DisplayStatus(signup);
  const feedbackLink = signup.token ? `${SITE_URL}/first20/feedback/${signup.token}` : null;

  async function setStatus(status: First20Signup["status"]) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from("first20_signups").update({ status }).eq("id", signup.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else onUpdated();
  }

  async function copyFeedbackLink() {
    if (!feedbackLink) return;
    try {
      await navigator.clipboard.writeText(feedbackLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API lehet nem elérhető — a link mező alatta akkor is kijelölhető.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted">Név</p>
          <p className="text-sm text-forest">
            {signup.first_name}
            {signup.partner_first_name && ` & ${signup.partner_first_name}`}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">E-mail</p>
          <a href={`mailto:${signup.email}`} className="text-sm text-forest hover:underline">
            {signup.email}
          </a>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Nyelv</p>
          <p className="text-sm text-forest">{LANG_LABEL[signup.language_choice]}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Forrás / jelölés</p>
          <p className="text-sm text-forest">{howHeardLabel ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Jelentkezés ideje</p>
          <p className="text-sm text-forest">{formatDate(signup.created_at)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Jelenlegi állapot</p>
          <span className={`badge ${FIRST20_DISPLAY_STATUS_STYLES[displayStatus]}`}>{displayStatus}</span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Státusz (kézzel is állítható)</label>
        <select
          className="select max-w-xs"
          value={signup.status}
          disabled={saving}
          onChange={(e) => setStatus(e.target.value as First20Signup["status"])}
        >
          {FIRST20_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Egyedi visszajelzési link</label>
        {feedbackLink ? (
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={feedbackLink} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copyFeedbackLink} className="btn btn-ghost shrink-0">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Másolva" : "Másolás"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">Nincs még token generálva — az első küldésnél automatikusan létrejön.</p>
        )}
      </div>

      {signup.email_error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-medium">Legutóbbi küldési hiba:</span> {signup.email_error}
        </div>
      )}
    </div>
  );
}
