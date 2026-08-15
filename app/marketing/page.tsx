"use client";

import { useEffect, useState } from "react";
import { Sprout, Sun, Leaf, Snowflake, Check } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { MarketingCampaign, Season } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";

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
        <PageHeader title="Marketing" />
        <p className="text-sm text-muted">Connect Supabase to plan seasonal campaigns.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Seasonal campaign planning for the four Zusammen launches of the year."
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
            />
          ))}
        </div>
      )}
    </>
  );
}

function CampaignCard({
  campaign,
  onUpdate,
}: {
  campaign: MarketingCampaign;
  onUpdate: (patch: Partial<MarketingCampaign>) => void;
}) {
  const [theme, setTheme] = useState(campaign.theme ?? "");
  const [productFocus, setProductFocus] = useState(campaign.product_focus ?? "");
  const [saved, setSaved] = useState(false);
  const { icon: Icon, accent } = SEASON_META[campaign.season];

  function commit() {
    const patch: Partial<MarketingCampaign> = {};
    if (theme !== (campaign.theme ?? "")) patch.theme = theme;
    if (productFocus !== (campaign.product_focus ?? "")) patch.product_focus = productFocus;
    if (Object.keys(patch).length > 0) {
      onUpdate(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
            <Icon size={19} />
          </span>
          <h2 className="font-serif text-xl text-forest">{campaign.season}</h2>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-medium text-forest">
            <Check size={13} /> Saved
          </span>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-muted">Theme</label>
        <input
          className="input"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onBlur={commit}
          placeholder="Campaign theme…"
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted">Product focus</label>
        <textarea
          className="textarea min-h-24"
          value={productFocus}
          onChange={(e) => setProductFocus(e.target.value)}
          onBlur={commit}
          placeholder="Which products / bundles are we pushing this season?"
        />
      </div>
    </div>
  );
}
