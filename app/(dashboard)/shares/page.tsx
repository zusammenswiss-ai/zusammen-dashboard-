"use client";

import { Share2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ShareContactsSection from "@/components/ShareContactsSection";

export default function SharesPage() {
  return (
    <>
      <PageHeader title="Megosztások" subtitle="Sajtó- és influencer-kapcsolatok, akikkel érdemes megosztani a Zusamment." />
      <div className="flex flex-col gap-6">
        {isSupabaseConfigured ? (
          <ShareContactsSection />
        ) : (
          <EmptyState
            icon={Share2}
            title="Csatlakoztasd a Supabase-t a kapcsolatok rögzítéséhez"
            description="Add hozzá a Supabase URL-t és az anon kulcsot a környezethez, majd tölts be újra."
          />
        )}
      </div>
    </>
  );
}
