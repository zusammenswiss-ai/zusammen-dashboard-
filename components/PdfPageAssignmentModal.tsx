"use client";

import { useEffect, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardAsset, CardCollection, CollectionCard } from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import { loadPdfDocument, renderPdfPage, dataUrlToBlob, HIGH_RES_SCALE, type ExtractedPdfPage, type PdfDocument } from "@/lib/pdf-pages";
import { createImageLayer } from "@/lib/card-layers";
import { errorMessage } from "@/lib/errors";

const MOCKUP_BUCKET = "card-assets";
// A Kártyatervező (LayeredCardEditor/CollectionGallery) a design_layers
// mezőt olvassa, ami a "card-designer" bucketből oldja fel a kép-
// rétegeket — ezért ugyanazt a kirenderelt oldalt ide is feltöltjük egy
// teljes vászon méretű képrétegként, HOGY A CÉLKÁRTYA/HÁTLAP A
// KÁRTYATERVEZŐBEN IS a valódi tartalmat mutassa, ne csak a Kártyák
// galériában — de csak akkor, ha a célnak MÉG NINCS saját design_layers
// beállítása, hogy egy már megkezdett, kézzel szerkesztett design ne
// vesszen el egy mockup-hozzárendeléskor.
const DESIGNER_BUCKET = "card-designer";

/**
 * PDF mockup feltöltés → oldalak kézi hozzárendelése (6. fázis) — a
 * gyártói automatikus oldal-párosítás technikailag nem megbízható (a
 * PDF oldalsorrendje nem feltétlenül egyezik a kártyák sorrendjével),
 * ezért ehelyett soronként választható ki, melyik kártyához (vagy a
 * kollekció hátlapjához) és melyik nyelvhez tartozik egy oldal — így a
 * Kártyák galéria a TÉNYLEGES, nyomdakész kinézetet tudja mutatni.
 */
export default function PdfPageAssignmentModal({
  asset,
  fileUrl,
  collection,
  cards,
  onClose,
  onCardUpdated,
  onCollectionUpdated,
}: {
  asset: CardAsset;
  fileUrl: string;
  collection: CardCollection;
  cards: CollectionCard[];
  onClose: () => void;
  onCardUpdated: (card: CollectionCard) => void;
  onCollectionUpdated: (collection: CardCollection) => void;
}) {
  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);
  const [pages, setPages] = useState<ExtractedPdfPage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [languages, setLanguages] = useState<Record<number, string>>({});
  const [savingPage, setSavingPage] = useState<number | null>(null);
  const [savedPages, setSavedPages] = useState<Set<number>>(new Set());
  const [rowError, setRowError] = useState<Record<number, string>>({});

  const defaultLanguage = collection.languages.includes(asset.language)
    ? asset.language
    : (collection.languages[0] ?? asset.language);
  const languageOptions = collection.languages.length > 0 ? collection.languages : [defaultLanguage];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fileUrl);
        const buf = await res.arrayBuffer();
        const doc = await loadPdfDocument(buf);
        if (cancelled) return;
        setPdfDoc(doc);
        const extracted: ExtractedPdfPage[] = [];
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
          extracted.push({ pageNumber, dataUrl: await renderPdfPage(doc, pageNumber, 1) });
        }
        if (!cancelled) setPages(extracted);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, "Nem sikerült feldolgozni a PDF-et."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  async function savePage(page: ExtractedPdfPage) {
    const supabase = getSupabaseClient();
    const target = targets[page.pageNumber];
    const lang = languages[page.pageNumber] ?? defaultLanguage;
    if (!supabase || !target || !pdfDoc) return;
    setSavingPage(page.pageNumber);
    setRowError((prev) => {
      const next = { ...prev };
      delete next[page.pageNumber];
      return next;
    });
    try {
      // A lapozáshoz betöltött page.dataUrl csak gyors előnézeti
      // felbontású (lásd lib/pdf-pages.ts PREVIEW_SCALE) — a ténylegesen
      // elmentett/mockup-ként megjelenő kép a nyomdai ellenőrzéshez
      // szükséges éles, nagy felbontású verzió legyen.
      const highResDataUrl = await renderPdfPage(pdfDoc, page.pageNumber, HIGH_RES_SCALE);
      const blob = dataUrlToBlob(highResDataUrl);
      const filename = `${Date.now()}-p${page.pageNumber}.png`;

      const mockupPath = `mockup-pages/${asset.id}/${filename}`;
      const { error: mockupError } = await supabase.storage
        .from(MOCKUP_BUCKET)
        .upload(mockupPath, blob, { upsert: false, contentType: "image/png" });
      if (mockupError) throw mockupError;
      const imageUrl = supabase.storage.from(MOCKUP_BUCKET).getPublicUrl(mockupPath).data.publicUrl;

      if (target === "back") {
        const nextImages = { ...collection.back_mockup_images, [lang]: imageUrl };
        const updatePayload: { back_mockup_images: typeof nextImages; back_design_layers?: ReturnType<typeof createImageLayer>[] } = {
          back_mockup_images: nextImages,
        };
        if (collection.back_design_layers.length === 0) {
          const designPath = `${crypto.randomUUID()}-${filename}`;
          const { error: designError } = await supabase.storage
            .from(DESIGNER_BUCKET)
            .upload(designPath, blob, { upsert: false, contentType: "image/png" });
          if (designError) throw designError;
          const designUrl = supabase.storage.from(DESIGNER_BUCKET).getPublicUrl(designPath).data.publicUrl;
          updatePayload.back_design_layers = [createImageLayer(designUrl, { x: 0, y: 0, width: 1, height: 1 })];
        }
        const { data, error } = await supabase
          .from("card_collections")
          .update(updatePayload)
          .eq("id", collection.id)
          .select()
          .single();
        if (error) throw error;
        if (data) onCollectionUpdated(data);
      } else {
        const card = cards.find((c) => c.id === target);
        if (!card) throw new Error("A kiválasztott kártya már nem található.");
        const nextImages = { ...card.mockup_images, [lang]: imageUrl };
        const updatePayload: { mockup_images: typeof nextImages; design_layers?: ReturnType<typeof createImageLayer>[] } = {
          mockup_images: nextImages,
        };
        if (card.design_layers.length === 0) {
          const designPath = `${crypto.randomUUID()}-${filename}`;
          const { error: designError } = await supabase.storage
            .from(DESIGNER_BUCKET)
            .upload(designPath, blob, { upsert: false, contentType: "image/png" });
          if (designError) throw designError;
          const designUrl = supabase.storage.from(DESIGNER_BUCKET).getPublicUrl(designPath).data.publicUrl;
          updatePayload.design_layers = [createImageLayer(designUrl, { x: 0, y: 0, width: 1, height: 1 })];
        }
        const { data, error } = await supabase
          .from("collection_cards")
          .update(updatePayload)
          .eq("id", card.id)
          .select()
          .single();
        if (error) throw error;
        if (data) onCardUpdated(data);
      }
      setSavedPages((prev) => new Set(prev).add(page.pageNumber));
    } catch (err) {
      setRowError((prev) => ({ ...prev, [page.pageNumber]: errorMessage(err, "Nem sikerült menteni.") }));
    } finally {
      setSavingPage(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <BackButton onClick={onClose} label="Vissza" />
            <h2 className="font-serif text-xl text-forest">
              Oldalak hozzárendelése — {asset.language} {asset.version}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Válaszd ki soronként, melyik kártyához (vagy a hátlaphoz) tartozik az oldal, és melyik nyelven — utána
              mentsd el.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {!pages && !loadError && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> PDF feldolgozása — ez nagyobb fájloknál eltarthat egy
              percig…
            </div>
          )}
          {pages && pages.length === 0 && (
            <p className="text-sm text-muted">A PDF üres, vagy nem sikerült oldalakat kinyerni belőle.</p>
          )}
          {pages && pages.length > 0 && (
            <div className="flex flex-col gap-3">
              {pages.map((page) => (
                <div
                  key={page.pageNumber}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
                >
                  {/* Data URL — a kliens-oldalon kirenderelt oldal, még
                      feltöltés előtt, ezért plain <img>, nem next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.dataUrl}
                    alt={`${page.pageNumber}. oldal`}
                    className="h-24 w-auto shrink-0 rounded-sm border border-border"
                  />
                  <span className="w-16 shrink-0 text-xs text-muted">{page.pageNumber}. oldal</span>
                  <select
                    className="select w-auto"
                    value={targets[page.pageNumber] ?? ""}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [page.pageNumber]: e.target.value }))}
                  >
                    <option value="">— Kihagyás —</option>
                    <option value="back">Hátlap</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.card_number} ({c.card_type})
                      </option>
                    ))}
                  </select>
                  <select
                    className="select w-auto"
                    value={languages[page.pageNumber] ?? defaultLanguage}
                    onChange={(e) => setLanguages((prev) => ({ ...prev, [page.pageNumber]: e.target.value }))}
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void savePage(page)}
                    disabled={!targets[page.pageNumber] || savingPage === page.pageNumber}
                    className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                  >
                    {savingPage === page.pageNumber ? (
                      "Mentés…"
                    ) : savedPages.has(page.pageNumber) ? (
                      <>
                        <Check size={13} /> Mentve
                      </>
                    ) : (
                      "Mentés"
                    )}
                  </button>
                  {rowError[page.pageNumber] && (
                    <p className="w-full text-xs text-red-600">{rowError[page.pageNumber]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border p-4">
          <button onClick={onClose} className="btn btn-ghost">
            Kész
          </button>
        </div>
      </div>
    </div>
  );
}
