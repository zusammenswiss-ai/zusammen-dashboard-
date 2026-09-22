"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardAsset, CardCollection, CollectionCard, CollectionCardType } from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import {
  loadPdfDocument,
  renderPdfPage,
  dataUrlToBlob,
  HIGH_RES_SCALE,
  type ExtractedPdfPage,
  type PdfDocument,
} from "@/lib/pdf-pages";
import { suggestCardNumber } from "@/lib/card-template";
import { createImageLayer } from "@/lib/card-layers";
import { COLLECTION_CARD_TYPES } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";

const MOCKUP_BUCKET = "card-assets";
// A Kártyatervező (LayeredCardEditor/CollectionGallery) a design_layers
// mezőt olvassa, ami a "card-designer" bucketből oldja fel a kép-
// rétegeket — külön a mockup_images-től, ami a "card-assets" bucketben
// van és csak a Kártyák galéria mutatja a designer élő rendere HELYETT.
// Hogy az importált kártya a Kártyatervezőben (nem csak a Kártyák
// galériában) is a valódi, kirenderelt oldalt mutassa, ugyanazt a
// már kirenderelt képet ide is feltöltjük, egy teljes vászon méretű
// képrétegként — pontosan úgy, ahogy a LoadFromFilesModal is teszi
// egyetlen kártya kézi betöltésénél.
const DESIGNER_BUCKET = "card-designer";

type RowRole = "skip" | "card" | "back";

/**
 * Egy többoldalas PDF-mockupból (pl. az 58 kártyás, előlap+hátlap
 * párokat tartalmazó production fájl) egyszerre TÖBB kártya
 * importálása a Kártyák modulba — a PdfPageAssignmentModal (egy
 * oldal → egy MÁR LÉTEZŐ kártya) kiegészítése arra az esetre, amikor
 * a kártyák még nem is léteznek: ez oldalanként ÚJ collection_cards
 * sort hoz létre. A kirenderelt PDF-oldal (nem placeholder, a
 * tényleges nyomdakész vizuális tartalom) egyszerre kerül mockup-
 * képként (mockup_images — ezt mutatja a Kártyák galéria) ÉS teljes
 * vászon méretű, szerkeszthető képrétegként (design_layers — ezt
 * mutatja a Kártyatervező canvasa és a Galéria-előnézet), hogy az
 * importált kártya MINDKÉT helyen a valódi tartalmat mutassa, ne csak
 * a Kártyák nézetben.
 */
export default function PdfBulkImportModal({
  asset,
  fileUrl,
  collection,
  cards,
  onClose,
  onCardsCreated,
  onCollectionUpdated,
}: {
  asset: CardAsset;
  fileUrl: string;
  collection: CardCollection;
  cards: CollectionCard[];
  onClose: () => void;
  onCardsCreated: (cards: CollectionCard[]) => void;
  onCollectionUpdated: (collection: CardCollection) => void;
}) {
  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);
  const [pages, setPages] = useState<ExtractedPdfPage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowRole, setRowRole] = useState<Record<number, RowRole>>({});
  const [numberOverrides, setNumberOverrides] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<number>>(new Set());
  const [rowError, setRowError] = useState<Record<number, string>>({});

  const defaultLanguage = collection.languages.includes(asset.language)
    ? asset.language
    : (collection.languages[0] ?? asset.language);
  const languageOptions = collection.languages.length > 0 ? collection.languages : [defaultLanguage];
  const [language, setLanguage] = useState(defaultLanguage);
  const [cardType, setCardType] = useState<CollectionCardType>(COLLECTION_CARD_TYPES[0]);

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

  function setRole(pageNumber: number, role: RowRole) {
    setRowRole((prev) => {
      const next = { ...prev, [pageNumber]: role };
      // Legfeljebb egy oldal lehet a hátlap egyszerre.
      if (role === "back") {
        for (const key of Object.keys(next)) {
          const num = Number(key);
          if (num !== pageNumber && next[num] === "back") next[num] = "skip";
        }
      }
      return next;
    });
  }

  // Az "Új kártya" szerepű oldalakhoz sorban javasolt azonosító — ugyanaz
  // a logika, mint a Kollekció részletes nézete "Automatikus azonosító"
  // gombjánál (suggestCardNumber), csak a batch minden korábban javasolt
  // számát is figyelembe véve, hogy egymást követő oldalak ne kapjanak
  // ütköző számot.
  const suggestedNumbers = useMemo(() => {
    const map = new Map<number, string>();
    let pool: { card_number: string; card_type: CollectionCardType }[] = cards.map((c) => ({
      card_number: c.card_number,
      card_type: c.card_type,
    }));
    for (const page of pages ?? []) {
      if (rowRole[page.pageNumber] !== "card") continue;
      const suggestion = suggestCardNumber(pool, cardType);
      map.set(page.pageNumber, suggestion);
      pool = [...pool, { card_number: suggestion, card_type: cardType }];
    }
    return map;
  }, [pages, rowRole, cardType, cards]);

  const cardPages = (pages ?? []).filter((p) => rowRole[p.pageNumber] === "card");
  const backPage = (pages ?? []).find((p) => rowRole[p.pageNumber] === "back") ?? null;
  const selectedCount = cardPages.length + (backPage ? 1 : 0);

  async function uploadHighRes(pageNumber: number): Promise<{ mockupUrl: string; designUrl: string }> {
    if (!pdfDoc) throw new Error("A PDF még nincs betöltve.");
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Nincs Supabase kapcsolat.");
    const dataUrl = await renderPdfPage(pdfDoc, pageNumber, HIGH_RES_SCALE);
    const blob = dataUrlToBlob(dataUrl);
    const filename = `${Date.now()}-p${pageNumber}.png`;

    const mockupPath = `mockup-pages/${asset.id}/${filename}`;
    const { error: mockupError } = await supabase.storage
      .from(MOCKUP_BUCKET)
      .upload(mockupPath, blob, { upsert: false, contentType: "image/png" });
    if (mockupError) throw mockupError;
    const mockupUrl = supabase.storage.from(MOCKUP_BUCKET).getPublicUrl(mockupPath).data.publicUrl;

    const designPath = `${crypto.randomUUID()}-${filename}`;
    const { error: designError } = await supabase.storage
      .from(DESIGNER_BUCKET)
      .upload(designPath, blob, { upsert: false, contentType: "image/png" });
    if (designError) throw designError;
    const designUrl = supabase.storage.from(DESIGNER_BUCKET).getPublicUrl(designPath).data.publicUrl;

    return { mockupUrl, designUrl };
  }

  async function runImport() {
    const supabase = getSupabaseClient();
    if (!supabase || selectedCount === 0) return;
    setImporting(true);
    setError(null);
    setRowError({});
    const createdCards: CollectionCard[] = [];
    let sortOrder = cards.length;
    try {
      for (let i = 0; i < cardPages.length; i++) {
        const page = cardPages[i];
        setProgress(`Importálás: ${i + 1}/${cardPages.length} kártya…`);
        try {
          const { mockupUrl, designUrl } = await uploadHighRes(page.pageNumber);
          const cardNumber = (numberOverrides[page.pageNumber] ?? suggestedNumbers.get(page.pageNumber) ?? "").trim();
          if (!cardNumber) throw new Error("Hiányzó azonosító.");
          const { data, error: insertError } = await supabase
            .from("collection_cards")
            .insert({
              collection_id: collection.id,
              card_number: cardNumber,
              card_type: cardType,
              sort_order: sortOrder++,
              mockup_images: { [language]: mockupUrl },
              design_layers: [createImageLayer(designUrl, { x: 0, y: 0, width: 1, height: 1 })],
            })
            .select()
            .single();
          if (insertError) throw insertError;
          if (data) {
            createdCards.push(data);
            setImported((prev) => new Set(prev).add(page.pageNumber));
          }
        } catch (err) {
          setRowError((prev) => ({ ...prev, [page.pageNumber]: errorMessage(err, "Nem sikerült importálni.") }));
        }
      }

      if (backPage) {
        setProgress("Hátlap importálása…");
        try {
          const { mockupUrl, designUrl } = await uploadHighRes(backPage.pageNumber);
          const nextImages = { ...collection.back_mockup_images, [language]: mockupUrl };
          const { data, error: updateError } = await supabase
            .from("card_collections")
            .update({
              back_mockup_images: nextImages,
              back_design_layers: [createImageLayer(designUrl, { x: 0, y: 0, width: 1, height: 1 })],
            })
            .eq("id", collection.id)
            .select()
            .single();
          if (updateError) throw updateError;
          if (data) {
            onCollectionUpdated(data);
            setImported((prev) => new Set(prev).add(backPage.pageNumber));
          }
        } catch (err) {
          setRowError((prev) => ({ ...prev, [backPage.pageNumber]: errorMessage(err, "Nem sikerült importálni.") }));
        }
      }

      if (createdCards.length > 0) onCardsCreated(createdCards);
    } finally {
      setImporting(false);
      setProgress("");
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
              Kártyák importálása — {asset.language} {asset.version}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Jelöld ki soronként, mely oldalak legyenek ÚJ kártyák (és legfeljebb egy, ami a közös hátlap), majd
              indítsd az importálást — az oldal éles, nagy felbontású képe kerül a kártyára mockup-ként.
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
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Nyelv (a kijelölt kártyák/hátlap ehhez kap mockup-képet)</label>
                  <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {languageOptions.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Kártya típus (mindegyik importált kártyára)</label>
                  <select className="select" value={cardType} onChange={(e) => setCardType(e.target.value as CollectionCardType)}>
                    {COLLECTION_CARD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {pages.map((page) => {
                  const role = rowRole[page.pageNumber] ?? "skip";
                  return (
                    <div
                      key={page.pageNumber}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- kliens-oldalon kirenderelt data URL előnézet */}
                      <img
                        src={page.dataUrl}
                        alt={`${page.pageNumber}. oldal`}
                        className="h-24 w-auto shrink-0 rounded-sm border border-border"
                      />
                      <span className="w-16 shrink-0 text-xs text-muted">{page.pageNumber}. oldal</span>
                      <select
                        className="select w-auto"
                        value={role}
                        onChange={(e) => setRole(page.pageNumber, e.target.value as RowRole)}
                      >
                        <option value="skip">— Kihagyás —</option>
                        <option value="card">Új kártya</option>
                        <option value="back">Hátlap</option>
                      </select>
                      {role === "card" && (
                        <input
                          className="input w-32 !py-1.5 text-xs"
                          value={numberOverrides[page.pageNumber] ?? suggestedNumbers.get(page.pageNumber) ?? ""}
                          onChange={(e) => setNumberOverrides((prev) => ({ ...prev, [page.pageNumber]: e.target.value }))}
                          placeholder="Azonosító"
                        />
                      )}
                      {imported.has(page.pageNumber) && (
                        <span className="badge bg-forest/10 text-forest">
                          <Check size={11} /> Importálva
                        </span>
                      )}
                      {rowError[page.pageNumber] && (
                        <p className="w-full text-xs text-red-600">{rowError[page.pageNumber]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <p className="text-xs text-muted">{selectedCount} oldal kijelölve</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing || selectedCount === 0}
              className="btn btn-primary"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {importing ? progress || "Importálás…" : `Importálás (${selectedCount})`}
            </button>
            <button onClick={onClose} className="btn btn-ghost">
              Kész
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
