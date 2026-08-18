"use client";

import { useEffect, useState } from "react";
import { Sprout, Sun, Leaf, Snowflake, Check, Mail, Lock, Unlock } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { MarketingCampaign, Season } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmailComposeModal from "@/components/EmailComposeModal";
import { SEASON_HU } from "@/lib/labels";

const SEASON_ORDER: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

const SEASON_META: Record<Season, { icon: typeof Sun; accent: string }> = {
  Spring: { icon: Sprout, accent: "bg-forest/10 text-forest" },
  Summer: { icon: Sun, accent: "bg-bronze/15 text-walnut" },
  Autumn: { icon: Leaf, accent: "bg-walnut/15 text-walnut" },
  Winter: { icon: Snowflake, accent: "bg-forest-light/10 text-forest" },
};

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [composeFor, setComposeFor] = useState<MarketingCampaign | null>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) {
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.from("marketing_campaigns").select("*");
      if (error) setError(error.message);
      else {
        const sorted = [...(data ?? [])].sort(
          (a, b) => SEASON_ORDER.indexOf(a.season) - SEASON_ORDER.indexOf(b.season)
        );
        setCampaigns(sorted);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateCampaign(id: string, patch: Partial<MarketingCampaign>) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (!supabase) return;
    const { error } = await supabase.from("marketing_campaigns").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Marketing" backHref="/" />
        <p className="text-sm text-muted">Csatlakoztasd a Supabase-t a szezonális kampányok tervezéséhez.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Szezonális kampánytervezés a Zusammen négy éves kampányához."
        backHref="/"
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onUpdate={(patch) => updateCampaign(campaign.id, patch)}
              onEmail={() => setComposeFor(campaign)}
            />
          ))}
        </div>
      )}

      {composeFor && (
        <EmailComposeModal
          title={`Email küldése — ${SEASON_HU[composeFor.season]} kampány`}
          defaultSubject={`Zusammen — ${SEASON_HU[composeFor.season]} kampány${composeFor.theme ? `: ${composeFor.theme}` : ""}`}
          defaultBody={
            composeFor.product_focus ? `Szia!\n\n${composeFor.product_focus}\n\n` : "Szia!\n\n"
          }
          onClose={() => setComposeFor(null)}
        />
      )}
    </>
  );
}

function CampaignCard({
  campaign,
  onUpdate,
  onEmail,
}: {
  campaign: MarketingCampaign;
  onUpdate: (patch: Partial<MarketingCampaign>) => void;
  onEmail: () => void;
}) {
  // Locked by default so the card can't be edited by an accidental click —
  // "Feloldás" opens it up for editing, "Rögzítés" saves and locks it back.
  const [locked, setLocked] = useState(true);
  const [theme, setTheme] = useState(campaign.theme ?? "");
  const [productFocus, setProductFocus] = useState(campaign.product_focus ?? "");
  const [saved, setSaved] = useState(false);
  const { icon: Icon, accent } = SEASON_META[campaign.season];

  function unlock() {
    setTheme(campaign.theme ?? "");
    setProductFocus(campaign.product_focus ?? "");
    setLocked(false);
  }

  function cancel() {
    setTheme(campaign.theme ?? "");
    setProductFocus(campaign.product_focus ?? "");
    setLocked(true);
  }

  function commitAndLock() {
    const patch: Partial<MarketingCampaign> = {};
    if (theme !== (campaign.theme ?? "")) patch.theme = theme;
    if (productFocus !== (campaign.product_focus ?? "")) patch.product_focus = productFocus;
    if (Object.keys(patch).length > 0) {
      onUpdate(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setLocked(true);
  }

  return (
    <div className={`card p-5 ${locked ? "" : "ring-2 ring-bronze/40"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
            <Icon size={19} />
          </span>
          <h2 className="font-serif text-xl text-forest">{SEASON_HU[campaign.season]}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-forest">
              <Check size={13} /> Mentve
            </span>
          )}
          <button onClick={onEmail} className="btn btn-ghost !px-2" aria-label="Email küldése">
            <Mail size={15} />
          </button>
          {locked ? (
            <button
              onClick={unlock}
              className="btn btn-ghost !px-2"
              aria-label="Feloldás szerkesztéshez"
              title="Feloldás szerkesztéshez"
            >
              <Lock size={15} />
            </button>
          ) : (
            <button
              onClick={commitAndLock}
              className="btn btn-bronze !px-2"
              aria-label="Rögzítés"
              title="Rögzítés"
            >
              <Unlock size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-muted">Téma</label>
        {locked ? (
          <p className="rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
            {campaign.theme || <span className="text-muted">Nincs megadva</span>}
          </p>
        ) : (
          <input
            className="input"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Kampány témája…"
            autoFocus
          />
        )}
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted">Termékfókusz</label>
        {locked ? (
          <p className="whitespace-pre-wrap rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
            {campaign.product_focus || <span className="text-muted">Nincs megadva</span>}
          </p>
        ) : (
          <textarea
            className="textarea min-h-24"
            value={productFocus}
            onChange={(e) => setProductFocus(e.target.value)}
            placeholder="Milyen termékeket / csomagokat tolunk előtérbe ebben a szezonban?"
          />
        )}
      </div>

      {!locked && (
        <div className="mt-3 flex justify-end">
          <button onClick={cancel} className="btn btn-ghost text-xs">
            Mégse
          </button>
        </div>
      )}
    </div>
  );
}
