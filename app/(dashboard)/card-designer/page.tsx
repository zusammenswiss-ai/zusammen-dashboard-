"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Palette } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CardCollection, CardExportVersion, CardTemplate, CollectionCard } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import TemplatesSection from "@/components/card-designer/TemplatesSection";
import CollectionsSection from "@/components/card-designer/CollectionsSection";
import { errorMessage } from "@/lib/errors";

type Tab = "collections" | "templates";

/**
 * Kártyatervező — a vizuális nyomdai tervezés és verziókezelés modulja.
 * Szándékosan külön a "Kártyák" (/cards, a kérdés-szövegek tartalom-
 * könyvtára) és a "Kártya-fájlok" (/card-assets, nyers fájltárolás)
 * mellett: ez itt a gyártói sablonok + kollekciók + kártyalisták helye.
 * 1. fázis: adatmodell + CRUD, még szerkesztő/export nélkül.
 */
export default function CardDesignerPage() {
  const [tab, setTab] = useState<Tab>("collections");
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [collections, setCollections] = useState<CardCollection[]>([]);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [exportVersions, setExportVersions] = useState<CardExportVersion[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<{ collectionId: string; cardId: string | null; back: boolean } | null>(
    null
  );

  const supabase = getSupabaseClient();

  // Deep link a Kártyák galériából (/cards?collection=…&card=… vagy
  // &back=1) — ugyanaz a window.location minta, mint /tasks-nál, hogy
  // ne kelljen useSearchParams + Suspense boundary csak egy egyszeri
  // ellenőrzéshez.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get("collection");
    if (collectionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeepLink({ collectionId, cardId: params.get("card"), back: params.get("back") === "1" });
      setTab("collections");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [templatesRes, collectionsRes, cardsRes, exportVersionsRes] = await Promise.all([
      supabase.from("card_templates").select("*").order("name"),
      supabase.from("card_collections").select("*").order("created_at", { ascending: false }),
      supabase.from("collection_cards").select("*").order("sort_order"),
      supabase.from("card_export_versions").select("*").order("created_at", { ascending: false }),
    ]);
    if (templatesRes.error) setError(errorMessage(templatesRes.error, "Nem sikerült betölteni a sablonokat."));
    else setTemplates(templatesRes.data ?? []);
    if (collectionsRes.error) setError(errorMessage(collectionsRes.error, "Nem sikerült betölteni a kollekciókat."));
    else setCollections(collectionsRes.data ?? []);
    if (!cardsRes.error) setCards(cardsRes.data ?? []);
    if (!exportVersionsRes.error) setExportVersions(exportVersionsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Kártyatervező" />
        <EmptyState icon={Palette} title="Csatlakoztasd a Supabase-t a kártyatervezőhöz" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kártyatervező"
        subtitle="Gyártói sablonok, kollekciók és kártyák — a nyomdakész tervezés és verziókezelés egy helyen."
        action={
          <Link href="/card-assets" className="btn btn-ghost">
            Kártya-fájlok megnyitása
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setTab("collections")}
          className={`btn ${tab === "collections" ? "btn-bronze" : "btn-ghost"}`}
        >
          Kollekciók
        </button>
        <button onClick={() => setTab("templates")} className={`btn ${tab === "templates" ? "btn-bronze" : "btn-ghost"}`}>
          Sablonok
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : tab === "collections" ? (
        <CollectionsSection
          collections={collections}
          templates={templates}
          cards={cards}
          exportVersions={exportVersions}
          onCollectionsChange={setCollections}
          onCardsChange={setCards}
          onExportVersionsChange={setExportVersions}
          deepLink={deepLink}
        />
      ) : (
        <TemplatesSection templates={templates} onChange={setTemplates} />
      )}
    </>
  );
}
