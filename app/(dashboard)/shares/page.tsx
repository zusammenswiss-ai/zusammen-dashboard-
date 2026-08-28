"use client";

import { Share2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ShareContactsSection from "@/components/ShareContactsSection";
import DemandLinkSharesSection from "@/components/DemandLinkSharesSection";

export default function SharesPage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Megosztások" />
        <EmptyState
          icon={Share2}
          title="Csatlakoztasd a Supabase-t a megosztások rögzítéséhez"
          description="Add hozzá a Supabase URL-t és az anon kulcsot a környezethez, majd tölts be újra."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Megosztások"
        subtitle="Sajtó- és influencer-kapcsolatok, és a demand-test link megosztásainak naplója."
      />
      <div className="flex flex-col gap-6">
        <ShareContactsSection />
        <DemandLinkSharesSection />
      </div>
    </>
  );
}
