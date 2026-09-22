"use client";

import { useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardCollection, CardTemplate, CollectionCard } from "@/lib/supabase/types";
import { renderCutCardCanvas, resolveLayerImages } from "@/lib/card-render";
import { resolveSignedUrl } from "@/lib/signed-storage-url";
import { textForLanguage } from "@/lib/card-template";
import { computePrintGrid, paginate } from "@/lib/card-print";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-designer";

function bySortOrder(a: CollectionCard, b: CollectionCard) {
  return a.sort_order - b.sort_order;
}

type PrintPage = { kind: "front" | "back"; items: string[] };

/**
 * Otthoni/irodai nyomtatás (10. fázis) — a manufacturer-exporttal
 * (ExportPanel) szemben ez NEM egy letölthető fájlt készít, hanem
 * közvetlenül a böngésző `window.print()`-jével nyomtat: a kártyákat a
 * végleges (cut) méretükben, A4 lapra rácsba rendezve, minden kártya
 * körül vágásjelekkel, hogy a founder ollóval pontosan ki tudja vágni
 * őket. A kártyák CSS `in` mértékegységgel vannak méretezve, hogy a
 * nyomtatás fizikai mérete pontos legyen — a nyomtatási párbeszédben
 * a "Tényleges méret" / 100% skálázás beállítás kell hozzá (ne "Lapra
 * igazítás").
 */
export default function PrintPanel({
  collection,
  template,
  cards,
}: {
  collection: CardCollection;
  template: CardTemplate;
  cards: CollectionCard[];
}) {
  const languageOptions = collection.languages.length > 0 ? collection.languages : ["HU"];
  const [language, setLanguage] = useState(languageOptions[0]);
  const [includeBacks, setIncludeBacks] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PrintPage[] | null>(null);

  const grid = computePrintGrid(template.cut_width_in, template.cut_height_in);

  async function openPreview() {
    const supabase = getSupabaseClient();
    const sortedCards = [...cards].sort(bySortOrder);
    if (!supabase || sortedCards.length === 0) {
      setError("Ehhez a kollekcióhoz még nincs egy kártya sem.");
      return;
    }
    setRendering(true);
    setError(null);
    try {
      const frontItems: string[] = [];
      for (let i = 0; i < sortedCards.length; i++) {
        const card = sortedCards[i];
        setProgress(`Renderelés: ${i + 1}/${sortedCards.length} kártya (${card.card_number})`);
        const imageUrl = await resolveSignedUrl(supabase, STORAGE_BUCKET, card.image_url);
        const cardLayers = await resolveLayerImages(supabase, card.design_layers);
        const canvas = await renderCutCardCanvas(
          template,
          {
            background_color: card.background_color,
            image_url: imageUrl,
            image_x: card.image_x,
            image_y: card.image_y,
            image_scale: card.image_scale,
            text_font_size: card.text_font_size,
            text_align: card.text_align,
          },
          textForLanguage(card, language),
          cardLayers
        );
        frontItems.push(canvas.toDataURL("image/png"));
      }

      const nextPages: PrintPage[] = paginate(frontItems, grid.cardsPerPage).map((items) => ({ kind: "front", items }));

      if (includeBacks) {
        setProgress("Hátlap renderelése…");
        const backImageUrl = await resolveSignedUrl(supabase, STORAGE_BUCKET, collection.back_image_url);
        const backLayers = await resolveLayerImages(supabase, collection.back_design_layers);
        const backCanvas = await renderCutCardCanvas(
          template,
          {
            background_color: collection.back_background_color,
            image_url: backImageUrl,
            image_x: collection.back_image_x,
            image_y: collection.back_image_y,
            image_scale: collection.back_image_scale,
            text_font_size: 48,
            text_align: "center",
          },
          "",
          backLayers
        );
        const backDataUrl = backCanvas.toDataURL("image/png");
        const backItems = sortedCards.map(() => backDataUrl);
        nextPages.push(...paginate(backItems, grid.cardsPerPage).map((items) => ({ kind: "back" as const, items })));
      }

      setPages(nextPages);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült elkészíteni a nyomtatási nézetet."));
    } finally {
      setRendering(false);
      setProgress("");
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-xs font-medium text-bronze">Otthoni / irodai nyomtatás</p>
      <p className="mb-3 text-xs text-muted">
        A kártyákat a végleges (vágott) méretükben, A4 lapra rácsba rendezve, vágásjelekkel nyomtatja — ollós kivágáshoz,
        nem a gyártónak. Lap: {grid.cols}×{grid.rows} kártya/oldal.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nyelv</label>
          <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {languageOptions.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={includeBacks} onChange={(e) => setIncludeBacks(e.target.checked)} />
            Hátlap is (külön oldalakon)
          </label>
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      <button type="button" onClick={() => void openPreview()} disabled={rendering} className="btn btn-primary mt-3">
        {rendering ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
        {rendering ? progress || "Renderelés…" : "Nyomtatási nézet megnyitása"}
      </button>

      {pages && (
        <PrintPreview
          pages={pages}
          cutWidthIn={template.cut_width_in}
          cutHeightIn={template.cut_height_in}
          grid={grid}
          onClose={() => setPages(null)}
        />
      )}
    </div>
  );
}

/** Négy sarok-vágásjel — a kártya (cut méretű) doboz sarkaiból indulva
 * kifelé nyúlik a rács-cella vágásjel-zónájába, sosem a kártya képére.
 * Ugyanaz a konvenció, mint a nyomdai crop mark-oknál, csak a founder
 * ollójához igazítva (nincs külön "gap" a sarok és a jel között, mert
 * itthon nem kell a jelnek magának lemaradnia a vágott lapról). */
function CropMarks() {
  const tick = "0.16in";
  const base: React.CSSProperties = { position: "absolute", background: "#000" };
  return (
    <>
      <span style={{ ...base, top: 0, left: `-${tick}`, width: tick, height: "0.4pt" }} />
      <span style={{ ...base, top: `-${tick}`, left: 0, width: "0.4pt", height: tick }} />
      <span style={{ ...base, top: 0, right: `-${tick}`, width: tick, height: "0.4pt" }} />
      <span style={{ ...base, top: `-${tick}`, right: 0, width: "0.4pt", height: tick }} />
      <span style={{ ...base, bottom: 0, left: `-${tick}`, width: tick, height: "0.4pt" }} />
      <span style={{ ...base, bottom: `-${tick}`, left: 0, width: "0.4pt", height: tick }} />
      <span style={{ ...base, bottom: 0, right: `-${tick}`, width: tick, height: "0.4pt" }} />
      <span style={{ ...base, bottom: `-${tick}`, right: 0, width: "0.4pt", height: tick }} />
    </>
  );
}

function PrintPreview({
  pages,
  cutWidthIn,
  cutHeightIn,
  grid,
  onClose,
}: {
  pages: PrintPage[];
  cutWidthIn: number;
  cutHeightIn: number;
  grid: ReturnType<typeof computePrintGrid>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-forest/60 backdrop-blur-[2px]">
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          #print-root, #print-root * { visibility: visible; }
          #print-root { position: absolute; inset: 0; }
          .print-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
        }
        @page { size: A4; margin: 0; }
      `}</style>
      <div className="flex items-center justify-between gap-3 border-b border-border/20 bg-forest px-5 py-3 print:hidden">
        <p className="text-sm text-ivory">
          Nyomtatási nézet — {pages.length} oldal, {grid.cols}×{grid.rows} kártya/oldal
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="btn btn-primary !py-1.5 text-xs">
            <Printer size={14} /> Nyomtatás
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ivory hover:bg-white/10"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
        <div id="print-root" className="mx-auto flex flex-col items-center gap-6 print:gap-0">
          {pages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page grid place-content-center bg-white shadow-lg"
              style={{ width: "8.27in", height: "11.69in" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${grid.cols}, ${grid.cellWidthIn}in)`,
                  gridAutoRows: `${grid.cellHeightIn}in`,
                  justifyContent: "center",
                  alignContent: "center",
                }}
              >
                {page.items.map((dataUrl, i) => (
                  <div key={i} className="flex items-center justify-center">
                    <div style={{ position: "relative", width: `${cutWidthIn}in`, height: `${cutHeightIn}in` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL raszterizált kártyakép, nem Next Image-kezelendő távoli forrás */}
                      <img
                        src={dataUrl}
                        alt={`${page.kind === "front" ? "Előlap" : "Hátlap"} ${i + 1}`}
                        style={{ width: "100%", height: "100%", display: "block" }}
                      />
                      <CropMarks />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
