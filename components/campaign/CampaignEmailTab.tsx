"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, MarketingContent, EmailTemplate } from "@/lib/supabase/types";
import EmailCampaignSendForm from "@/components/EmailCampaignSendForm";
import EmptyState from "@/components/EmptyState";
import { Spinner } from "@/components/Feedback";
import { formatDate } from "@/lib/format";
import { Send } from "lucide-react";

/** E-mail fül — a kampányhoz tartozó, korábban kiküldött email-kampányok
 * (marketing_content, content_type = "Email"), és a meglévő "Email
 * kampányok" küldőforma, kampányhoz kötve — innen is küldhető ki, a
 * létrejövő tartalom automatikusan ehhez a kampányhoz kapcsolódik. */
export default function CampaignEmailTab({ campaign, content }: { campaign: Campaign; content: MarketingContent[] }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [demandCount, setDemandCount] = useState(0);
  const [newsletterCount, setNewsletterCount] = useState(0);
  const [first20Count, setFirst20Count] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<MarketingContent[]>(content);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    (async () => {
      setLoading(true);
      const [templatesRes, demandRes, newsletterRes, first20Res] = await Promise.all([
        supabase.from("email_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("landing_responses").select("email").not("email", "is", null),
        supabase.from("newsletter_subscribers").select("id").eq("unsubscribed", false),
        supabase.from("first20_signups").select("id", { count: "exact", head: true }),
      ]);
      if (!templatesRes.error) setTemplates(templatesRes.data ?? []);
      if (!demandRes.error) {
        const rows: { email: string | null }[] = demandRes.data ?? [];
        setDemandCount(new Set(rows.map((r) => r.email?.trim().toLowerCase()).filter(Boolean)).size);
      }
      if (!newsletterRes.error) setNewsletterCount((newsletterRes.data ?? []).length);
      if (!first20Res.error) setFirst20Count(first20Res.count ?? 0);
      setLoading(false);
    })();
  }, [campaign.id]);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-3 font-serif text-base text-forest">Korábbi kiküldések</h3>
        {sent.length === 0 ? (
          <EmptyState icon={Send} title="Még nincs kiküldött email ehhez a kampányhoz" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {sent.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate font-medium text-forest">{item.title}</span>
                <span className="shrink-0 text-xs text-muted">{formatDate(item.scheduled_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <EmailCampaignSendForm
        templates={templates}
        demandCount={demandCount}
        newsletterCount={newsletterCount}
        first20Count={first20Count}
        campaignId={campaign.id}
        onSent={(item) => setSent((prev) => [item, ...prev])}
      />
    </div>
  );
}
