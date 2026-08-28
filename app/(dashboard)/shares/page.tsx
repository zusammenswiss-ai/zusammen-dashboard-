"use client";

import { Share2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ShareLinkSection from "@/components/ShareLinkSection";
import ShareContactsSection from "@/components/ShareContactsSection";
import DemandLinkSharesSection from "@/components/DemandLinkSharesSection";

export default function SharesPage() {
  return (
    <>
      <PageHeader
        title="Megosztások"
        subtitle="A publikus Landing oldal megosztása, sajtó- és influencer-kapcsolatok, és a demand-test link megosztásainak naplója."
      />
      <div className="flex flex-col gap-6">
        {/* Link + QR code work with no Supabase at all — window.location
            and a stateless API route — so this shows even before the
            Supabase env vars are set, unlike the two sections below. */}
        <ShareLinkSection />
        {isSupabaseConfigured ? (
          <>
            <ShareContactsSection />
            <DemandLinkSharesSection />
          </>
        ) : (
          <EmptyState
            icon={Share2}
            title="Csatlakoztasd a Supabase-t a kapcsolatok és a megosztás-napló rögzítéséhez"
            description="Add hozzá a Supabase URL-t és az anon kulcsot a környezethez, majd tölts be újra."
          />
        )}
      </div>
    </>
  );
}
