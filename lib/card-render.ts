import type { CardTemplate, CardTextAlign } from "./supabase/types";
import { computeGuideRects, readableTextColor } from "./card-canvas";
import { templatePixelDims } from "./card-template";

export type RenderableDesign = {
  background_color: string | null;
  /** Már feloldott (pl. aláírt) URL, közvetlenül betölthető — nem a
   * Storage-ban tárolt nyers path. */
  image_url: string | null;
  image_x: number;
  image_y: number;
  image_scale: number;
  text_font_size: number;
  text_align: CardTextAlign;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nem sikerült betölteni a kép/logó fájlt."));
    img.src = url;
  });
}

/** Egy sor szövegre töri a szöveget a canvas 2D API `measureText`-jével
 * — a szerkesztő élő előnézete a böngésző natív sortörését (CSS
 * flexbox) használja, a tényleges exportnál viszont kézzel kell
 * eldönteni, hol törjön a sor, mert a `<canvas>` fillText nem tördel
 * automatikusan. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Egy kártya-design pontos pixelméretű, végleges (segédvonalak
 * NÉLKÜLI) renderelése — ugyanazt a geometriát használja, mint a
 * CardCanvasEditor élő előnézete (computeGuideRects a safe area
 * pozíciójához, readableTextColor a szövegszínhez), csak DOM/CSS
 * helyett valódi `<canvas>`-ra rajzolva, a sablon bleed pixelméretében.
 */
export async function renderCardCanvas(
  template: Pick<
    CardTemplate,
    "cut_width_in" | "cut_height_in" | "safe_width_in" | "safe_height_in" | "bleed_width_in" | "bleed_height_in" | "dpi"
  >,
  design: RenderableDesign,
  text: string
): Promise<HTMLCanvasElement> {
  const { width, height } = templatePixelDims(template);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A böngésző nem támogatja a canvas renderelést.");

  ctx.fillStyle = design.background_color ?? "#F3EFE7";
  ctx.fillRect(0, 0, width, height);

  if (design.image_url) {
    const img = await loadImage(design.image_url);
    const imgWidth = design.image_scale * width;
    const imgHeight = imgWidth * (img.naturalHeight / img.naturalWidth || 1);
    ctx.drawImage(img, design.image_x * width - imgWidth / 2, design.image_y * height - imgHeight / 2, imgWidth, imgHeight);
  }

  if (text.trim()) {
    const guides = computeGuideRects(template);
    const safeLeft = (guides.safe.insetXPct / 100) * width;
    const safeTop = (guides.safe.insetYPct / 100) * height;
    const safeWidth = width - 2 * safeLeft;
    const safeHeight = height - 2 * safeTop;

    ctx.fillStyle = readableTextColor(design.background_color);
    ctx.textBaseline = "middle";
    ctx.textAlign = design.text_align as CanvasTextAlign;
    ctx.font = `${design.text_font_size}px "Inter", "Helvetica Neue", Arial, sans-serif`;

    const lines = wrapText(ctx, text.trim(), safeWidth);
    const lineHeight = design.text_font_size * 1.3;
    const totalHeight = lines.length * lineHeight;
    const textX = design.text_align === "left" ? safeLeft : design.text_align === "right" ? safeLeft + safeWidth : safeLeft + safeWidth / 2;
    let y = safeTop + safeHeight / 2 - totalHeight / 2 + lineHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, textX, y);
      y += lineHeight;
    }
  }

  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nem sikerült PNG fájlt készíteni."))), "image/png");
  });
}
