"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RitualsSection from "@/components/RitualsSection";
import ContentCardsSection from "@/components/ContentCardsSection";

type Tab = "rituals" | "cards";

/**
 * Rituálék + a hozzájuk tartozó kérdés-kártyák tartalom-könyvtára — a
 * public.cards (cím/kérdés/mély kérdés/NFC/QR/verzió-előzmény) ide
 * költözött a korábbi /cards oldalról, amikor az a nyomdai
 * Kártyatervező-kártyák (collection_cards) vizuális galériája lett
 * (5. fázis) — lásd app/(dashboard)/cards/page.tsx komment-jét.
 */
export default function RitualsPage() {
  const [tab, setTab] = useState<Tab>("rituals");

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Rituálék" />
        <EmptyState icon={Sparkles} title="Csatlakoztasd a Supabase-t a rituálék kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Rituálék"
        subtitle="Ritual Builder és a hozzá tartozó kérdés-kártyák — összeállítható, verziózható tartalom."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => setTab("rituals")} className={`btn ${tab === "rituals" ? "btn-bronze" : "btn-ghost"}`}>
          Rituálék
        </button>
        <button onClick={() => setTab("cards")} className={`btn ${tab === "cards" ? "btn-bronze" : "btn-ghost"}`}>
          Kártyák
        </button>
      </div>

      {tab === "rituals" ? <RitualsSection /> : <ContentCardsSection />}
    </>
  );
}
