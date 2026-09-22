"use client";

import { useState } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Download, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  CardCollection,
  CardExportFormat,
  CardExportKind,
  CardExportVersion,
  CardTemplate,
  CollectionCard,
} from "@/lib/supabase/types";
import { renderCardCanvas, canvasToPngBlob } from "@/lib/card-render";
import { resolveSignedUrl } from "@/lib/signed-storage-url";
import { textForLanguage } from "@/lib/card-template";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-designer";

function bySortOrder(a: CollectionCard, b: CollectionCard) {
  return a.sort_order - b.sort_order;
}

/**
 * Kollekció-szintű Exportálás — minden kártyát a sablon pontos
 * pixelméretében renderel ki (segédvonalak nélkül, lásd
 * lib/card-render.ts), egy választott nyelvre, PNG (ZIP-ben) vagy PDF
 * formátumban, opcionálisan előlap+hátlap párban. A kész fájl a
 * card-designer bucket exports/ mappájába kerül, és egy card_export_
 * versions sor rögzíti — ez a "verziókezelés": egy korábbi export
 * sosem vész el, még ha a design azóta változott is.
 */
export default function ExportPanel({
  collection,
  template,
  cards,
  onVersionCreated,
}: {
  collection: CardCollection;
  template: CardTemplate;
  cards: CollectionCard[];
  onVersionCreated: (v: CardExportVersion) => void;
}) {
  const languageOptions = collection.languages.length > 0 ? collection.languages : ["HU"];
  const [language, setLanguage] = useState(languageOptions[0]);
  const [kind, setKind] = useState<CardExportKind>("fronts_only");
  const [format, setFormat] = useState<CardExportFormat>("png");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    const supabase = getSupabaseClient();
    const sortedCards = [...cards].sort(bySortOrder);
    if (!supabase || sortedCards.length === 0) {
      setError("Ehhez a kollekcióhoz még nincs egy kártya sem.");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      // A hátlap közös az egész kollekcióhoz — párban-exportnál egyszer
      // renderelődik, minden kártya ugyanazt kapja.
      let backCanvas: HTMLCanvasElement | null = null;
      if (kind === "front_back_pairs") {
        setProgress("Hátlap renderelése…");
        const backImageUrl = await resolveSignedUrl(supabase, STORAGE_BUCKET, collection.back_image_url);
        backCanvas = await renderCardCanvas(
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
          ""
        );
      }

      const pages: { canvas: HTMLCanvasElement; filename: string }[] = [];
      for (let i = 0; i < sortedCards.length; i++) {
        const card = sortedCards[i];
        setProgress(`Renderelés: ${i + 1}/${sortedCards.length} kártya (${card.card_number})`);
        const imageUrl = await resolveSignedUrl(supabase, STORAGE_BUCKET, card.image_url);
        const frontCanvas = await renderCardCanvas(
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
          textForLanguage(card, language)
        );
        const safeNumber = card.card_number.replace(/[^a-zA-Z0-9]+/g, "-");
        const prefix = String(i + 1).padStart(2, "0");
        pages.push({ canvas: frontCanvas, filename: `${prefix}-${safeNumber}-elolap.png` });
        if (kind === "front_back_pairs" && backCanvas) {
          pages.push({ canvas: backCanvas, filename: `${prefix}-${safeNumber}-hatlap.png` });
        }
      }

      setProgress(format === "pdf" ? "PDF összeállítása…" : "ZIP összeállítása…");
      const pageSize: [number, number] = [template.bleed_width_in, template.bleed_height_in];
      let fileBlob: Blob;
      let ext: string;
      if (format === "pdf") {
        const pdf = new jsPDF({ unit: "in", format: pageSize });
        pages.forEach((page, i) => {
          if (i > 0) pdf.addPage(pageSize);
          pdf.addImage(page.canvas.toDataURL("image/png"), "PNG", 0, 0, pageSize[0], pageSize[1]);
        });
        fileBlob = pdf.output("blob");
        ext = "pdf";
      } else {
        const zip = new JSZip();
        for (const page of pages) {
          zip.file(page.filename, await canvasToPngBlob(page.canvas));
        }
        fileBlob = await zip.generateAsync({ type: "blob" });
        ext = "zip";
      }

      setProgress("Feltöltés és mentés…");
      const kindSlug = kind === "front_back_pairs" ? "elolap-hatlap" : "elolapok";
      const path = `exports/${collection.id}/${Date.now()}-${language}-${kindSlug}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, fileBlob, { upsert: false });
      if (uploadError) throw uploadError;
      const fileUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

      const { data, error: insertError } = await supabase
        .from("card_export_versions")
        .insert({
          collection_id: collection.id,
          template_id: template.id,
          language,
          kind,
          format,
          card_count: sortedCards.length,
          file_url: fileUrl,
          supplier_id: collection.supplier_id,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Rögtön le is töltjük — nincs értelme a verzió-listából
      // visszakeresni az imént elkészült fájlt.
      const downloadUrl = URL.createObjectURL(fileBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = path.split("/").pop() ?? `export.${ext}`;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      if (data) onVersionCreated(data);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült elkészíteni az exportot."));
    } finally {
      setExporting(false);
      setProgress("");
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-xs font-medium text-bronze">Exportálás</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tartalom</label>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as CardExportKind)}>
            <option value="fronts_only">Csak előlapok (belső áttekintés)</option>
            <option value="front_back_pairs">Előlap+hátlap párban (gyártónak)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Fájlformátum</label>
          <select className="select" value={format} onChange={(e) => setFormat(e.target.value as CardExportFormat)}>
            <option value="png">PNG (ZIP-ben)</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      <button type="button" onClick={() => void handleExport()} disabled={exporting} className="btn btn-primary mt-3">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {exporting ? progress || "Exportálás…" : "Exportálás indítása"}
      </button>
    </div>
  );
}
