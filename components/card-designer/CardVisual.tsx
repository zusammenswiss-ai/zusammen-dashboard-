"use client";

import type { CardTemplate, CardTextAlign, DesignLayer } from "@/lib/supabase/types";
import { computeGuideRects, readableTextColor } from "@/lib/card-canvas";

/**
 * Statikus, nem-interaktív kártya-előnézet — ugyanaz a DOM/CSS
 * geometria, mint a LayeredCardEditor élő vászna, csak húzás/
 * szerkesztés nélkül, kis méretben. A Kártyák galéria rács-nézetéhez
 * (lásd app/(dashboard)/cards) — hogy egy kártya-bejegyzés valóban úgy
 * nézzen ki, mint a végleges nyomtatott kártya, ne csak szöveges
 * lista-sor legyen.
 *
 * Ha `layers` nem üres, a réteg-alapú modellt rajzolja ki (9. fázis) —
 * ilyenkor `design`/`text` csak a háttérszínhez, illetve a 'question'
 * forrású szövegrétegek tartalmához kell. Egyébként a régi, fix "egy
 * kép + egy szövegblokk" modellt mutatja (még nem migrált kártyák).
 */
export default function CardVisual({
  template,
  design,
  text,
  textFontSize = 48,
  textAlign = "center",
  layers = [],
  showGuides = false,
  widthPx = 160,
}: {
  template: CardTemplate;
  design: {
    background_color: string | null;
    image_url: string | null;
    image_x: number;
    image_y: number;
    image_scale: number;
  };
  text?: string;
  textFontSize?: number;
  textAlign?: CardTextAlign;
  /** Réteg-alapú elrendezés (9. fázis) — image url-eknek már feloldott
   * (pl. aláírt) URL-nek kell lenniük, ugyanaz a minta, mint design.image_url. */
  layers?: DesignLayer[];
  showGuides?: boolean;
  widthPx?: number;
}) {
  const heightPx = widthPx * (template.bleed_height_in / template.bleed_width_in);
  const guides = computeGuideRects(template);
  const textColor = readableTextColor(design.background_color);
  // A betűméret a sablon tényleges pixelméretéhez van kalibrálva (lásd
  // lib/card-template.ts templatePixelDims) — a kicsinyített előnézetben
  // arányosan kisebb, hogy a valódi nyomtatott arányt tükrözze.
  const bleedWidthPx = template.dpi * template.bleed_width_in;
  const scaleFont = (px: number) => Math.max((px * widthPx) / bleedWidthPx, 5);

  return (
    <div
      className="relative select-none overflow-hidden rounded-sm shadow-sm"
      style={{ width: widthPx, height: heightPx, backgroundColor: design.background_color ?? "#F3EFE7" }}
    >
      {layers.length > 0
        ? layers.map((layer) => {
            const boxStyle = {
              left: `${layer.x * 100}%`,
              top: `${layer.y * 100}%`,
              width: `${layer.width * 100}%`,
              height: `${layer.height * 100}%`,
            };
            if (layer.type === "image") {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={layer.id} src={layer.url} alt="" className="absolute object-fill" style={boxStyle} />
              );
            }
            if (layer.type === "shape") {
              return (
                <div key={layer.id} className="absolute" style={{ ...boxStyle, backgroundColor: layer.color }} />
              );
            }
            const content = layer.source === "question" ? (text ?? "") : (Object.values(layer.content)[0] ?? "");
            return (
              <div
                key={layer.id}
                className="absolute flex items-center overflow-hidden whitespace-pre-wrap leading-tight"
                style={{
                  ...boxStyle,
                  color: layer.color,
                  fontSize: scaleFont(layer.fontSize),
                  fontFamily: layer.fontFamily,
                  textAlign: layer.align,
                  justifyContent: layer.align === "left" ? "flex-start" : layer.align === "right" ? "flex-end" : "center",
                }}
              >
                <span>{content}</span>
              </div>
            );
          })
        : (
          <>
            {design.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.image_url}
                alt=""
                className="absolute"
                style={{
                  width: `${design.image_scale * 100}%`,
                  left: `${design.image_x * 100}%`,
                  top: `${design.image_y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}

            {text && (
              <div
                className="absolute flex items-center whitespace-pre-wrap p-0.5 leading-tight"
                style={{
                  left: `${guides.safe.insetXPct}%`,
                  right: `${guides.safe.insetXPct}%`,
                  top: `${guides.safe.insetYPct}%`,
                  bottom: `${guides.safe.insetYPct}%`,
                  color: textColor,
                  fontSize: scaleFont(textFontSize),
                  textAlign,
                  justifyContent: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center",
                }}
              >
                <span>{text}</span>
              </div>
            )}
          </>
        )}

      {showGuides && (
        <div
          className="pointer-events-none absolute border border-dashed border-forest/50"
          style={{
            left: `${guides.safe.insetXPct}%`,
            right: `${guides.safe.insetXPct}%`,
            top: `${guides.safe.insetYPct}%`,
            bottom: `${guides.safe.insetYPct}%`,
          }}
        />
      )}
    </div>
  );
}
