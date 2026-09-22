import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardTemplate, CardTextAlign, Database, DesignLayer } from "./supabase/types";
import { computeGuideRects, readableTextColor } from "./card-canvas";
import { templatePixelDims } from "./card-template";
import { resolveSignedUrls } from "./signed-storage-url";

const STORAGE_BUCKET = "card-designer";

/** A réteg-alapú modellnél (9. fázis) minden kép-réteg url-jét aláírt
 * URL-re kell cserélni renderelés előtt — ugyanaz a minta, mint a régi
 * fix image_url mezőnél, csak rétegenként. Hívja meg a caller a
 * renderCardCanvas layers paramétere elé (lásd ExportPanel/
 * CollectionGallery). */
export async function resolveLayerImages(supabase: SupabaseClient<Database>, layers: DesignLayer[]): Promise<DesignLayer[]> {
  const urls = layers.filter((l) => l.type === "image").map((l) => l.url);
  if (urls.length === 0) return layers;
  const resolved = await resolveSignedUrls(supabase, STORAGE_BUCKET, urls);
  return layers.map((l) => (l.type === "image" ? { ...l, url: resolved.get(l.url) ?? l.url } : l));
}

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

type PxBox = { x: number; y: number; width: number; height: number };

function drawTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: PxBox,
  fontSizePx: number,
  color: string,
  align: CardTextAlign,
  fontFamily: string
) {
  if (!text.trim()) return;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align as CanvasTextAlign;
  ctx.font = `${fontSizePx}px ${fontFamily}`;

  const lines = wrapText(ctx, text.trim(), box.width);
  const lineHeight = fontSizePx * 1.3;
  const totalHeight = lines.length * lineHeight;
  const textX = align === "left" ? box.x : align === "right" ? box.x + box.width : box.x + box.width / 2;
  let y = box.y + box.height / 2 - totalHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    ctx.fillText(line, textX, y);
    y += lineHeight;
  }
}

/**
 * Egy réteget rajzol a canvasra a saját (0-1 törtben megadott)
 * x/y/width/height doboza szerint. Kép rétegnél a `layer.url`-nek MÁR
 * feloldott (pl. aláírt) URL-nek kell lennie — a hívó felelőssége,
 * ugyanaz a minta, mint a RenderableDesign.image_url-nél. `text` a
 * 'question' forrású szövegréteghez tartozó, már az aktuális nyelvre
 * feloldott szöveg (lásd renderCardCanvas language paramétere).
 */
async function drawLayer(ctx: CanvasRenderingContext2D, layer: DesignLayer, width: number, height: number, questionText: string) {
  const box: PxBox = { x: layer.x * width, y: layer.y * height, width: layer.width * width, height: layer.height * height };
  if (layer.type === "image") {
    const img = await loadImage(layer.url);
    ctx.drawImage(img, box.x, box.y, box.width, box.height);
  } else if (layer.type === "shape") {
    ctx.fillStyle = layer.color;
    ctx.fillRect(box.x, box.y, box.width, box.height);
  } else {
    const content = layer.source === "question" ? questionText : "";
    drawTextInBox(ctx, content, box, layer.fontSize, layer.color, layer.align, layer.fontFamily);
  }
}

/**
 * Egy kártya-design pontos pixelméretű, végleges (segédvonalak
 * NÉLKÜLI) renderelése — ugyanazt a geometriát használja, mint a
 * LayeredCardEditor élő előnézete (computeGuideRects a safe area
 * pozíciójához, readableTextColor a szövegszínhez), csak DOM/CSS
 * helyett valódi `<canvas>`-ra rajzolva, a sablon bleed pixelméretében.
 *
 * Ha `layers` nem üres, a réteg-alapú modell szerint rajzol (9. fázis)
 * — a `design`/`text` paraméterek ekkor csak a háttérszínhez, illetve
 * a 'question' forrású szövegrétegek tartalmához kellenek. Ha `layers`
 * üres/hiányzik, a régi, fix "egy kép + egy szövegblokk" modellt
 * rajzolja (visszamenőleg még nem migrált kártyák/hátlapok).
 */
export async function renderCardCanvas(
  template: Pick<
    CardTemplate,
    "cut_width_in" | "cut_height_in" | "safe_width_in" | "safe_height_in" | "bleed_width_in" | "bleed_height_in" | "dpi"
  >,
  design: RenderableDesign,
  text: string,
  layers: DesignLayer[] = []
): Promise<HTMLCanvasElement> {
  const { width, height } = templatePixelDims(template);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A böngésző nem támogatja a canvas renderelést.");

  ctx.fillStyle = design.background_color ?? "#F3EFE7";
  ctx.fillRect(0, 0, width, height);

  if (layers.length > 0) {
    for (const layer of layers) {
      await drawLayer(ctx, layer, width, height, text);
    }
    return canvas;
  }

  if (design.image_url) {
    const img = await loadImage(design.image_url);
    const imgWidth = design.image_scale * width;
    const imgHeight = imgWidth * (img.naturalHeight / img.naturalWidth || 1);
    ctx.drawImage(img, design.image_x * width - imgWidth / 2, design.image_y * height - imgHeight / 2, imgWidth, imgHeight);
  }

  if (text.trim()) {
    const guides = computeGuideRects(template);
    const safeBox: PxBox = {
      x: (guides.safe.insetXPct / 100) * width,
      y: (guides.safe.insetYPct / 100) * height,
      width: width - 2 * (guides.safe.insetXPct / 100) * width,
      height: height - 2 * (guides.safe.insetYPct / 100) * height,
    };
    drawTextInBox(
      ctx,
      text,
      safeBox,
      design.text_font_size,
      readableTextColor(design.background_color),
      design.text_align,
      '"Inter", "Helvetica Neue", Arial, sans-serif'
    );
  }

  return canvas;
}

/**
 * Ugyanaz, mint renderCardCanvas, de a bleed vászon helyett a cut
 * (végleges) méretre vágva — otthoni/irodai nyomtatáshoz kell (10.
 * fázis, lib/card-print.ts), ahol nincs értelme a szakmai bleed
 * ráhagyásnak, mert a founder ollóval a végleges méret szerint vág.
 */
export async function renderCutCardCanvas(
  template: Pick<
    CardTemplate,
    "cut_width_in" | "cut_height_in" | "safe_width_in" | "safe_height_in" | "bleed_width_in" | "bleed_height_in" | "dpi"
  >,
  design: RenderableDesign,
  text: string,
  layers: DesignLayer[] = []
): Promise<HTMLCanvasElement> {
  const bleedCanvas = await renderCardCanvas(template, design, text, layers);
  const guides = computeGuideRects(template);
  const sx = (guides.cut.insetXPct / 100) * bleedCanvas.width;
  const sy = (guides.cut.insetYPct / 100) * bleedCanvas.height;
  const sw = bleedCanvas.width - 2 * sx;
  const sh = bleedCanvas.height - 2 * sy;
  const cutCanvas = document.createElement("canvas");
  cutCanvas.width = Math.round(sw);
  cutCanvas.height = Math.round(sh);
  const ctx = cutCanvas.getContext("2d");
  if (!ctx) throw new Error("A böngésző nem támogatja a canvas renderelést.");
  ctx.drawImage(bleedCanvas, sx, sy, sw, sh, 0, 0, cutCanvas.width, cutCanvas.height);
  return cutCanvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nem sikerült PNG fájlt készíteni."))), "image/png");
  });
}
