"use client";

import { HeartHandshake } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import GoldCardLettersSection from "@/components/GoldCardLettersSection";
import JourneyPassportSection from "@/components/JourneyPassportSection";
import SurpriseQuestionSection from "@/components/SurpriseQuestionSection";

export default function PersonalRitualPage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Személyes rituálé" />
        <EmptyState
          icon={HeartHandshake}
          title="Csatlakoztasd a Supabase-t a rituálék rögzítéséhez"
          description="Add hozzá a Supabase URL-t és az anon kulcsot a környezethez, majd tölts be újra."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Személyes rituálé"
        subtitle="Gold Card Letters, a közös Journey és a Meglepetés kérdés — mind egy helyen."
      />

      <div className="flex flex-col gap-6">
        <GoldCardLettersSection />
        <JourneyPassportSection />
        <SurpriseQuestionSection />
      </div>
    </>
  );
}
