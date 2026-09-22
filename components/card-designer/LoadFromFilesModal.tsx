"use client";

import { useEffect, useMemo, useState } from "react";
import { FileStack, Loader2, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardAsset } from "@/lib/supabase/types";
import BackButton from "@/components/BackButton";
import { loadPdfDocument, renderPdfPage, dataUrlToBlob, HIGH_RES_SCALE, type ExtractedPdfPage, type PdfDocument } from "@/lib/pdf-pages";
import { resolveSignedUrls } from "@/lib/signed-storage-url";
import { isImageFile, isPreviewableInBrowser } from "@/lib/file-open";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-assets";

/**
 * "Betöltés fájlból" — a Kártyatervezőben a már feltöltött Kártya-fájlok
 * (elsősorban PDF production mockup) egy oldalát (vagy egy önálló
 * kép-fájlt) tölti be a szerkesztő vásznára képrétegként, hogy onnantól
 * a meglévő eszközökkel tovább lehessen szerkeszteni, vagy csak
 * referenciaként meg lehessen hagyni. Ez a hiányzó láncszem a Kártyák /
 * Kártyatervező / Kártya-fájlok hármas között — eddig egy feltöltött
 * PDF oldala csak a Kártyák galéria mockup-képeként volt elérhető, a
 * szerkesztőbe nem lehetett visszatölteni.
 */
export default function LoadFromFilesModal({
  collectionId,
  onSelect,
  onClose,
}: {
  collectionId: string;
  /** A hívó a Promise-t megvárja, mielőtt a modal saját töltés-
   * jelzését eltünteti — a kiválasztott oldal/kép feltöltése is ez
   * alatt fut, nem csak a PDF-oldal renderelése. */
  onSelect: (blob: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<CardAsset[] | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [showAllAssets, setShowAllAssets] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState<CardAsset | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);
  const [pages, setPages] = useState<ExtractedPdfPage[] | null>(null);
  const [pageLoadError, setPageLoadError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    (async () => {
      const { data, error: loadError } = await supabase
        .from("card_assets")
        .select("*")
        .order("created_at", { ascending: false });
      if (loadError) {
        setError(errorMessage(loadError, "Nem sikerült betölteni a fájllistát."));
        return;
      }
      const previewable = (data ?? []).filter((a) => isPreviewableInBrowser(a.file_url) || isImageFile(a.file_url));
      setAssets(previewable);
      setSignedUrls(await resolveSignedUrls(supabase, STORAGE_BUCKET, previewable.map((a) => a.file_url)));
    })();
  }, []);

  const visibleAssets = useMemo(() => {
    if (!assets) return [];
    const list = showAllAssets ? assets : assets.filter((a) => a.collection_id === collectionId);
    return list.length > 0 ? list : assets;
  }, [assets, showAllAssets, collectionId]);

  async function openAsset(asset: CardAsset) {
    const fileUrl = signedUrls.get(asset.file_url) ?? asset.file_url;
    if (isImageFile(asset.file_url)) {
      // Egyszerű kép-fájl — nincs mit lapozni, közvetlenül ez a réteg tartalma.
      setLoadingAssetId(asset.id);
      setError(null);
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`A kép letöltése sikertelen (${res.status}).`);
        const blob = await res.blob();
        await onSelect(blob);
      } catch (err) {
        setError(errorMessage(err, "Nem sikerült betölteni a képet."));
      } finally {
        setLoadingAssetId(null);
      }
      return;
    }
    setSelectedAsset(asset);
    setPageLoadError(null);
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`A PDF letöltése sikertelen (${res.status}).`);
      const buf = await res.arrayBuffer();
      const doc = await loadPdfDocument(buf);
      setPdfDoc(doc);
      const extracted: ExtractedPdfPage[] = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        extracted.push({ pageNumber, dataUrl: await renderPdfPage(doc, pageNumber, 1) });
      }
      setPages(extracted);
    } catch (err) {
      setPageLoadError(errorMessage(err, "Nem sikerült feldolgozni a PDF-et."));
    }
  }

  async function selectPage(pageNumber: number) {
    if (!pdfDoc) return;
    setLoadingPage(pageNumber);
    try {
      const dataUrl = await renderPdfPage(pdfDoc, pageNumber, HIGH_RES_SCALE);
      await onSelect(dataUrlToBlob(dataUrl));
    } catch (err) {
      setPageLoadError(errorMessage(err, "Nem sikerült betölteni az oldalt."));
    } finally {
      setLoadingPage(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={(e) => {
        // Ne buborékoljon fel a LayeredCardEditor saját háttér-
        // kattintás-kezelőjéhez (ami az egész szerkesztőt zárná be) —
        // ez a modal a szerkesztőn belül nyílik, a sajátja csak ezt a
        // fájlválasztót zárja be.
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            {selectedAsset ? (
              <BackButton
                onClick={() => {
                  setSelectedAsset(null);
                  setPdfDoc(null);
                  setPages(null);
                  setPageLoadError(null);
                }}
                label="Vissza a fájllistához"
              />
            ) : null}
            <h2 className="font-serif text-xl text-forest">
              {selectedAsset ? `Oldal kiválasztása — ${selectedAsset.version}` : "Betöltés fájlból"}
            </h2>
            {!selectedAsset && (
              <p className="mt-1 text-xs text-muted">
                Válassz egy Kártya-fájlokba feltöltött fájlt — PDF-nél utána az oldalt is kiválaszthatod.
              </p>
            )}
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
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!selectedAsset && (
            <>
              {!assets && !error && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={16} className="animate-spin" /> Fájlok betöltése…
                </div>
              )}
              {assets && assets.length === 0 && (
                <p className="text-sm text-muted">Még nincs feltöltött PDF vagy kép a Kártya-fájlok fülön.</p>
              )}
              {assets && assets.length > 0 && (
                <>
                  {assets.some((a) => a.collection_id === collectionId) && (
                    <label className="mb-3 flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" checked={showAllAssets} onChange={(e) => setShowAllAssets(e.target.checked)} />
                      Összes fájl mutatása (nem csak ennek a kollekciónak)
                    </label>
                  )}
                  <div className="flex flex-col gap-2">
                    {visibleAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => void openAsset(asset)}
                        disabled={loadingAssetId !== null}
                        className="flex items-center gap-3 rounded-md border border-border p-3 text-left hover:border-bronze/40 disabled:opacity-50"
                      >
                        <FileStack size={18} className="shrink-0 text-bronze" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-forest">
                            {asset.version} <span className="text-muted">— {asset.language}</span>
                          </p>
                          <p className="text-xs text-muted">{formatDate(asset.created_at)}</p>
                        </div>
                        {loadingAssetId === asset.id && <Loader2 size={14} className="animate-spin text-muted" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {selectedAsset && (
            <>
              {pageLoadError && <p className="text-sm text-red-600">{pageLoadError}</p>}
              {!pages && !pageLoadError && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={16} className="animate-spin" /> PDF feldolgozása — ez nagyobb fájloknál eltarthat egy
                  percig…
                </div>
              )}
              {pages && pages.length === 0 && (
                <p className="text-sm text-muted">A PDF üres, vagy nem sikerült oldalakat kinyerni belőle.</p>
              )}
              {pages && pages.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {pages.map((page) => (
                    <button
                      key={page.pageNumber}
                      type="button"
                      onClick={() => void selectPage(page.pageNumber)}
                      disabled={loadingPage !== null}
                      className="flex flex-col items-center gap-1 rounded-md border border-border p-1.5 hover:border-bronze/40 disabled:opacity-50"
                    >
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- kliens-oldalon kirenderelt data URL előnézet */}
                        <img src={page.dataUrl} alt={`${page.pageNumber}. oldal`} className="h-28 w-auto rounded-sm" />
                        {loadingPage === page.pageNumber && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                            <Loader2 size={16} className="animate-spin text-bronze" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">{page.pageNumber}. oldal</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
