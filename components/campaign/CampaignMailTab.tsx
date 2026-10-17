"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import EntityMailThreadsSection from "@/components/mail/EntityMailThreadsSection";

/**
 * Kampány → Levelek — a feladat 5/B/b pontja ("Marketing a saját
 * kampánya alatt beágyazva jelenjen meg"): a kampányhoz közvetlenül
 * kapcsolt szálak (entity_type='campaign', pl. egy jövőbeli manuális
 * hozzárendelés) ÉS — First 20 típusú kampánynál — a kampány összes
 * jelentkezőjének saját szála, egy helyen, nem duplikálva a
 * signup-szintű "Levelek" szakaszt (SignupEmailsTab), csak
 * összegyűjtve.
 */
export default function CampaignMailTab({ campaign }: { campaign: Campaign }) {
  const [signupIds, setSignupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(campaign.type === "First 20");

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase || campaign.type !== "First 20") {
      setSignupIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("first20_signups").select("id").eq("campaign_id", campaign.id);
    setSignupIds((data ?? []).map((s) => s.id));
    setLoading(false);
  }, [supabase, campaign.id, campaign.type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <EntityMailThreadsSection entityType="campaign" entityIds={[campaign.id]} title="Közvetlenül a kampányhoz kapcsolt szálak" />
      {campaign.type === "First 20" && !loading && (
        <EntityMailThreadsSection entityType="signup" entityIds={signupIds} title="A kampány jelentkezőinek levelei" />
      )}
    </div>
  );
}
