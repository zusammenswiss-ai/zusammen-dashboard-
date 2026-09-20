"use client";

import { useState } from "react";
import { HeartHandshake, Stamp, MapPin, Shuffle } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import GoldCardLettersSection from "@/components/GoldCardLettersSection";
import JourneyPassportSection from "@/components/JourneyPassportSection";
import SurpriseQuestionSection from "@/components/SurpriseQuestionSection";

type Tab = "letters" | "journey" | "question";

export default function PersonalRitualPage() {
  const [tab, setTab] = useState<Tab>("letters");

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

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setTab("letters")}
          className={`btn ${tab === "letters" ? "btn-bronze" : "btn-ghost"}`}
        >
          <Stamp size={15} /> Gold Card Letters
        </button>
        <button
          onClick={() => setTab("journey")}
          className={`btn ${tab === "journey" ? "btn-bronze" : "btn-ghost"}`}
        >
          <MapPin size={15} /> Journey (Passport)
        </button>
        <button
          onClick={() => setTab("question")}
          className={`btn ${tab === "question" ? "btn-bronze" : "btn-ghost"}`}
        >
          <Shuffle size={15} /> Meglepetés kérdés
        </button>
      </div>

      {tab === "letters" && <GoldCardLettersSection />}
      {tab === "journey" && <JourneyPassportSection />}
      {tab === "question" && <SurpriseQuestionSection />}
    </>
  );
}
