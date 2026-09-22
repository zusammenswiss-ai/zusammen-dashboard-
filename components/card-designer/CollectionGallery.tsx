"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardTemplate, CollectionCard } from "@/lib/supabase/types";
import { renderCardCanvas, resolveLayerImages } from "@/lib/card-render";
import { resolveSignedUrl } from "@/lib/signed-storage-url";
import { textForLanguage } from "@/lib/card-template";

const STORAGE_BUCKET = "card-designer";

function bySortOrder(a: CollectionCard, b: CollectionCard) {
  return a.sort_order - b.sort_order;
}

/**
 * Áttekintő galéria — a kollekció első kártyáját (mintakártya) rendereli
 * ki egymás mellett, minden nyelven, hogy egy pillantással lássa a
 * founder: "ez a HU, ez a DE, ez az EN verzió, ez az aktuális
 * állapotuk". Mindig a JELENLEGI design-t mutatja (élőben renderelve,
 * ugyanazzal a lib/card-render.ts-szel, mint az Exportálás) — nem egy
 * korábbi exportált fájlt, azok a VersionHistoryList-ben élnek.
 */
export default function CollectionGallery({
  template,
  cards,
  languages,
}: {
  template: CardTemplate | null;
  cards: CollectionCard[];
  languages: string[];
}) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [rendering, setRendering] = useState(false);

  const coverCard = [...cards].sort(bySortOrder)[0] ?? null;
  const langs = languages.length > 0 ? languages : ["HU"];

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();
    if (!supabase || !template || !coverCard) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThumbnails(new Map());
      return;
    }
    setRendering(true);
    (async () => {
      const imageUrl = await resolveSignedUrl(supabase, STORAGE_BUCKET, coverCard.image_url);
      const layers = await resolveLayerImages(supabase, coverCard.design_layers);
      const next = new Map<string, string>();
      for (const lang of langs) {
        const canvas = await renderCardCanvas(
          template,
          {
            background_color: coverCard.background_color,
            image_url: imageUrl,
            image_x: coverCard.image_x,
            image_y: coverCard.image_y,
            image_scale: coverCard.image_scale,
            text_font_size: coverCard.text_font_size,
            text_align: coverCard.text_align,
          },
          textForLanguage(coverCard, lang),
          layers
        );
        next.set(lang, canvas.toDataURL("image/png"));
      }
      if (!cancelled) setThumbnails(next);
    })().finally(() => {
      if (!cancelled) setRendering(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- langs.join(",") is the stable re-run key; langs itself is a fresh array reference every render when languages is empty
  }, [template, coverCard, langs.join(",")]);

  if (!template) {
    return <p className="text-xs text-muted">Válassz sablont a kollekciónak a galéria-előnézet megjelenítéséhez.</p>;
  }
  if (!coverCard) {
    return <p className="text-xs text-muted">Adj hozzá legalább egy kártyát a galéria-előnézet megjelenítéséhez.</p>;
  }

  return (
    <div className="flex flex-wrap gap-4">
      {langs.map((lang) => {
        const thumbnail = thumbnails.get(lang);
        return (
          <div key={lang} className="flex flex-col items-center gap-1.5">
            <div
              className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-ivory-dim shadow-sm"
              style={{ width: 120, aspectRatio: `${template.bleed_width_in} / ${template.bleed_height_in}` }}
            >
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnail} alt={`${lang} mintakártya`} className="block h-full w-full object-contain" />
              ) : (
                rendering && <Loader2 size={16} className="animate-spin text-muted" />
              )}
            </div>
            <span className="badge bg-ivory-dim text-walnut">{lang}</span>
          </div>
        );
      })}
    </div>
  );
}
