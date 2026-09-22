"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Maximize2, Palette, RefreshCw } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CardCollection, CardTemplate, CollectionCard, CollectionCardType, DesignLayer, ImageDesignLayer } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import CollapsibleSection from "@/components/CollapsibleSection";
import CardVisual from "@/components/card-designer/CardVisual";
import Lightbox from "@/components/Lightbox";
import { resolveSignedUrls } from "@/lib/signed-storage-url";
import { textForLanguage } from "@/lib/card-template";
import { CARD_COLLECTION_STATUS_STYLES, COLLECTION_CARD_TYPES } from "@/lib/labels";

const STORAGE_BUCKET = "card-designer";
// A PDF-ből kinyert, valódi mockup-oldalak a Kártya-fájlok modul saját
// (szintén privát) bucketjébe kerülnek feltöltésre — lásd
// PdfPageAssignmentModal — nem ugyanoda, mint a designer saját kép/logó
// feltöltései, ezért külön signed-URL feloldás kell rájuk.
const MOCKUP_STORAGE_BUCKET = "card-assets";
type TypeFilter = "Mind" | CollectionCardType | "Hátlap";

/**
 * Kártyák — a Kártyatervező kollekcióinak VIZUÁLIS galériája: minden
 * kártya-bejegyzés úgy jelenik meg, ahogy a nyomtatott kártyán is
 * kinézne (háttérszín, kép, szöveg a safe-zónában), rács-nézetben,
 * kollekciónként csoportosítva. Ez korábban a public.cards (rituálé-
 * kérdés kártyák) tartalom-könyvtára volt — az a Rituálék "Kártyák"
 * fülére költözött (5. fázis), mert ez a menü a nyomdai kártyák
 * "főoldalaként" jóval fontosabb: innen nyílik meg egy kattintással a
 * Kártyatervező, pontosan az adott kártyával betöltve.
 */
export default function CardsPage() {
  const [collections, setCollections] = useState<CardCollection[]>([]);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [mockupSignedUrls, setMockupSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Mind");

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [collectionsRes, templatesRes, cardsRes] = await Promise.all([
      supabase.from("card_collections").select("*").order("created_at", { ascending: false }),
      supabase.from("card_templates").select("*").order("name"),
      supabase.from("collection_cards").select("*").order("sort_order"),
    ]);
    if (collectionsRes.error) setError(collectionsRes.error.message);
    else setCollections(collectionsRes.data ?? []);
    if (!templatesRes.error) setTemplates(templatesRes.data ?? []);
    if (!cardsRes.error) setCards(cardsRes.data ?? []);

    const imageUrls: (string | null)[] = [
      ...(cardsRes.data ?? []).map((c) => c.image_url),
      ...(collectionsRes.data ?? []).map((c) => c.back_image_url),
      ...(cardsRes.data ?? []).flatMap((c: CollectionCard): string[] =>
        c.design_layers.filter((l): l is ImageDesignLayer => l.type === "image").map((l) => l.url)
      ),
      ...(collectionsRes.data ?? []).flatMap((c: CardCollection): string[] =>
        c.back_design_layers.filter((l): l is ImageDesignLayer => l.type === "image").map((l) => l.url)
      ),
    ];
    setSignedUrls(await resolveSignedUrls(supabase, STORAGE_BUCKET, imageUrls));

    const mockupUrls: string[] = [
      ...(cardsRes.data ?? []).flatMap((c): string[] => Object.values(c.mockup_images)),
      ...(collectionsRes.data ?? []).flatMap((c): string[] => Object.values(c.back_mockup_images)),
    ];
    setMockupSignedUrls(await resolveSignedUrls(supabase, MOCKUP_STORAGE_BUCKET, mockupUrls));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  // Deep link a Kártya-fájlok "Kollekció" linkjéből (/cards?collection=…).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get("collection");
    if (collectionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollectionFilter(collectionId);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    for (const c of collections) {
      if (collectionFilter && c.id !== collectionFilter) continue;
      for (const lang of c.languages) set.add(lang);
    }
    return [...set].sort();
  }, [collections, collectionFilter]);

  // Ha a jelenlegi nyelv-szűrő már nem elérhető (pl. kollekció-váltás
  // után), csendben visszaáll az első elérhető nyelvre.
  const effectiveLanguage = availableLanguages.includes(languageFilter) ? languageFilter : availableLanguages[0] ?? "";

  const visibleCollections = collections
    .filter((c) => !collectionFilter || c.id === collectionFilter)
    .filter((c) => cards.some((card) => card.collection_id === c.id) || c.back_background_color);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Kártyák" />
        <EmptyState icon={CreditCard} title="Csatlakoztasd a Supabase-t a kártyák kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kártyák"
        subtitle="A kollekciók nyomdakész kártyáinak vizuális áttekintése — kattints egy kártyára a szerkesztéshez."
        action={
          <Link href="/card-designer" className="btn btn-ghost">
            <Palette size={16} /> Kártyatervező megnyitása
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      {!loading && collections.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select
            className="select w-auto"
            value={collectionFilter}
            onChange={(e) => {
              setCollectionFilter(e.target.value);
              setLanguageFilter("");
            }}
          >
            <option value="">Összes kollekció</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {availableLanguages.length > 0 && (
            <div className="flex items-center gap-1.5">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguageFilter(lang)}
                  className={`badge cursor-pointer border ${
                    effectiveLanguage === lang ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}

          <select
            className="select w-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="Mind">Minden típus</option>
            {COLLECTION_CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="Hátlap">Hátlap</option>
          </select>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : collections.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Még nincs kollekció"
          description="Hozz létre egy kollekciót a Kártyatervezőben, majd add hozzá a kártyáit — itt fognak vizuálisan megjelenni."
        />
      ) : visibleCollections.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nincs megjeleníthető kártya" description="Próbálj más szűrőt." />
      ) : (
        <div className="flex flex-col gap-8">
          {visibleCollections.map((collection) => (
            <CollectionCardGrid
              key={collection.id}
              collection={collection}
              template={collection.template_id ? templateById.get(collection.template_id) ?? null : null}
              cards={cards.filter((c) => c.collection_id === collection.id)}
              language={effectiveLanguage}
              typeFilter={typeFilter}
              signedUrls={signedUrls}
              mockupSignedUrls={mockupSignedUrls}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CollectionCardGrid({
  collection,
  template,
  cards,
  language,
  typeFilter,
  signedUrls,
  mockupSignedUrls,
}: {
  collection: CardCollection;
  template: CardTemplate | null;
  cards: CollectionCard[];
  language: string;
  typeFilter: TypeFilter;
  signedUrls: Map<string, string>;
  mockupSignedUrls: Map<string, string>;
}) {
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [lightboxSlot, setLightboxSlot] = useState<{ url: string; label: string } | null>(null);

  function resolveLayers(layers: DesignLayer[]): DesignLayer[] {
    return layers.map((l) => (l.type === "image" ? { ...l, url: signedUrls.get(l.url) ?? l.url } : l));
  }

  function toggleFlip(id: string) {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCards = cards.filter((c) => typeFilter === "Mind" || typeFilter === c.card_type);
  const backMockupRaw = language ? collection.back_mockup_images[language] : undefined;
  const backMockup = backMockupRaw ? mockupSignedUrls.get(backMockupRaw) : undefined;
  const showBack =
    (typeFilter === "Mind" || typeFilter === "Hátlap") && (Boolean(backMockup) || Boolean(collection.back_background_color));
  // Sablon nélkül is megjeleníthető egy kártya, ha van hozzá VALÓDI,
  // PDF-ből kinyert mockup-kép (lásd PdfPageAssignmentModal) — a
  // szintetikus CardVisual-render az, aminek a sablon kell.
  const renderableCards = filteredCards.filter((c) => template || (language && c.mockup_images[language]));
  const nothingRenderable = !template && !backMockup && renderableCards.length === 0;

  return (
    <div>
      <CollapsibleSection
        title={
          <span className="flex items-center gap-2">
            <h2 className="font-serif text-lg text-forest">{collection.name}</h2>
            <span className={`badge ${CARD_COLLECTION_STATUS_STYLES[collection.status]}`}>{collection.status}</span>
          </span>
        }
        right={<span className="badge bg-ivory-dim text-walnut">{filteredCards.length} kártya</span>}
        actions={
          <Link
            href={`/card-assets?collection=${collection.id}`}
            className="shrink-0 text-xs text-muted underline decoration-dotted hover:text-forest"
          >
            Kapcsolódó fájlok
          </Link>
        }
        storageKey={`zusammen-collapsed-cards-collection-${collection.id}`}
        headerClassName="mb-3"
      >
        {nothingRenderable ? (
          <p className="text-xs text-muted">
            Ehhez a kollekcióhoz még nincs sablon, sem hozzárendelt mockup-kép —{" "}
            <Link href={`/card-designer?collection=${collection.id}`} className="underline hover:text-forest">
              válassz sablont a Kártyatervezőben
            </Link>{" "}
            vagy rendelj hozzá oldalakat egy feltöltött PDF-ből a Kártya-fájloknál.
          </p>
        ) : renderableCards.length === 0 && !showBack ? (
          <p className="text-xs text-muted">Nincs a szűrőnek megfelelő kártya ebben a kollekcióban.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {showBack && (
              <div className="relative">
                <Link
                  href={`/card-designer?collection=${collection.id}&back=1`}
                  className="flex flex-col items-center gap-1.5 rounded-md border-2 border-transparent p-1 hover:border-bronze/40"
                >
                  {backMockup ? (
                    // A tényleges, PDF-ből kinyert hátlap-kép — nem a
                    // designer élő rendere.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={backMockup} alt="Hátlap" className="h-auto w-40 rounded-sm border border-border shadow-sm" />
                  ) : (
                    template && (
                      <CardVisual
                        template={template}
                        design={{
                          background_color: collection.back_background_color,
                          image_url: collection.back_image_url
                            ? signedUrls.get(collection.back_image_url) ?? null
                            : null,
                          image_x: collection.back_image_x,
                          image_y: collection.back_image_y,
                          image_scale: collection.back_image_scale,
                        }}
                        layers={resolveLayers(collection.back_design_layers)}
                      />
                    )
                  )}
                  <span className="badge bg-ivory-dim text-walnut">Hátlap</span>
                </Link>
                {backMockup && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLightboxSlot({ url: backMockup, label: `Hátlap — ${collection.name}` });
                    }}
                    className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white hover:bg-black/70"
                    aria-label="Nagyítás"
                    title="Teljes méretű nézet"
                  >
                    <Maximize2 size={13} />
                  </button>
                )}
              </div>
            )}
            {renderableCards.map((card) => {
              const mockupRaw = language ? card.mockup_images[language] : undefined;
              const mockup = mockupRaw ? mockupSignedUrls.get(mockupRaw) : undefined;
              const flipped = flippedIds.has(card.id);
              const showingBack = flipped && Boolean(backMockup);
              const displayedMockup = showingBack ? backMockup : mockup;
              return (
                <div key={card.id} className="relative">
                  <Link
                    href={`/card-designer?collection=${collection.id}&card=${card.id}`}
                    className="flex flex-col items-center gap-1.5 rounded-md border-2 border-transparent p-1 hover:border-bronze/40"
                  >
                    {displayedMockup ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayedMockup}
                        alt={showingBack ? `${card.card_number} — hátlap` : card.card_number}
                        className="h-auto w-40 rounded-sm border border-border shadow-sm"
                      />
                    ) : (
                      template && (
                        <CardVisual
                          template={template}
                          design={{
                            background_color: card.background_color,
                            image_url: card.image_url ? signedUrls.get(card.image_url) ?? null : null,
                            image_x: card.image_x,
                            image_y: card.image_y,
                            image_scale: card.image_scale,
                          }}
                          text={
                            language ? textForLanguage(card, language) : card.text_hu || card.text_de || card.text_en || ""
                          }
                          textFontSize={card.text_font_size}
                          textAlign={card.text_align}
                          layers={resolveLayers(card.design_layers)}
                        />
                      )
                    )}
                    <div className="flex items-center gap-1">
                      <span className="badge bg-ivory-dim text-walnut">{card.card_number}</span>
                      <span className="badge bg-bronze/10 text-walnut">{card.card_type}</span>
                      {showingBack ? (
                        <span className="badge bg-forest/10 text-forest">Hátlap</span>
                      ) : (
                        mockup && <span className="badge bg-forest/10 text-forest">Mockup</span>
                      )}
                    </div>
                  </Link>
                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                    {mockup && backMockup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFlip(card.id);
                        }}
                        className="rounded-md bg-black/50 p-1 text-white hover:bg-black/70"
                        aria-label="Előlap/hátlap váltása"
                        title="Előlap/hátlap váltása"
                      >
                        <RefreshCw size={13} />
                      </button>
                    )}
                    {displayedMockup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLightboxSlot({
                            url: displayedMockup,
                            label: showingBack ? `${card.card_number} — hátlap` : card.card_number,
                          });
                        }}
                        className="rounded-md bg-black/50 p-1 text-white hover:bg-black/70"
                        aria-label="Nagyítás"
                        title="Teljes méretű nézet"
                      >
                        <Maximize2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
      {lightboxSlot && (
        <Lightbox src={lightboxSlot.url} alt={lightboxSlot.label} onClose={() => setLightboxSlot(null)} />
      )}
    </div>
  );
}
