"use client";

import type { CardTemplate, CardTextAlign } from "@/lib/supabase/types";
import { computeGuideRects, readableTextColor } from "@/lib/card-canvas";

/**
 * Statikus, nem-interaktív kártya-előnézet — ugyanaz a DOM/CSS
 * geometria, mint a CardCanvasEditor élő vászna (háttérszín, pozicionált
 * kép, safe-zónán belüli szöveg), csak húzás/szerkesztés nélkül, kis
 * méretben. A Kártyák galéria rács-nézetéhez (lásd app/(dashboard)/cards)
 * — hogy egy kártya-bejegyzés valóban úgy nézzen ki, mint a végleges
 * nyomtatott kártya, ne csak szöveges lista-sor legyen.
 */
export default function CardVisual({
  template,
  design,
  text,
  textFontSize = 48,
  textAlign = "center",
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
  const previewFontPx = (textFontSize * widthPx) / bleedWidthPx;

  return (
    <div
      className="relative select-none overflow-hidden rounded-sm shadow-sm"
      style={{ width: widthPx, height: heightPx, backgroundColor: design.background_color ?? "#F3EFE7" }}
    >
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
            fontSize: Math.max(previewFontPx, 5),
            textAlign,
            justifyContent: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center",
          }}
        >
          <span>{text}</span>
        </div>
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
