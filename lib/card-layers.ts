import type { CardTemplate, DesignLayer, ImageDesignLayer, ShapeDesignLayer, TextDesignLayer } from "./supabase/types";
import { computeGuideRects, readableTextColor } from "./card-canvas";

/** Curated font choices for szövegdoboz rétegek — a két márka-betűtípus
 * (Fraunces/Inter, lásd app/globals.css) plusz néhány biztonságosan
 * rendszer-elérhető klasszikus, hogy legyen valódi választék anélkül,
 * hogy egyedi webfont-betöltést kellene bevezetni a szerkesztőbe. */
export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Fraunces (márka szerif)", value: 'var(--font-fraunces), Georgia, serif' },
  { label: "Inter (márka sans)", value: 'var(--font-sans), "Helvetica Neue", Arial, sans-serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Helvetica", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
];
export const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0].value;

function newLayerId(): string {
  return crypto.randomUUID();
}

export function createTextLayer(partial: Partial<TextDesignLayer> = {}): TextDesignLayer {
  return {
    id: newLayerId(),
    type: "text",
    source: "custom",
    content: {},
    x: 0.1,
    y: 0.4,
    width: 0.8,
    height: 0.2,
    fontSize: 48,
    color: "#233328",
    align: "center",
    fontFamily: DEFAULT_FONT_FAMILY,
    ...partial,
  };
}

export function createImageLayer(url: string, partial: Partial<ImageDesignLayer> = {}): ImageDesignLayer {
  return {
    id: newLayerId(),
    type: "image",
    url,
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.3,
    ...partial,
  };
}

export function createShapeLayer(partial: Partial<ShapeDesignLayer> = {}): ShapeDesignLayer {
  return {
    id: newLayerId(),
    type: "shape",
    color: "#5C1A24",
    x: 0,
    y: 0,
    width: 0.08,
    height: 1,
    ...partial,
  };
}

/**
 * Egy még nem ebben az új szerkesztőben átdolgozott kártya kezdeti
 * rétegei — a régi fix image és text mezőkből származtatva, hogy a
 * founder ne nulláról kezdje, ha megnyitja a szerkesztőt. Ez CSAK
 * kezdő állapot a helyi komponens-state-hez — nem íródik vissza az
 * adatbázisba, amíg ő maga nem menti el.
 */
export function legacyToLayers(
  template: Pick<
    CardTemplate,
    "cut_width_in" | "cut_height_in" | "safe_width_in" | "safe_height_in" | "bleed_width_in" | "bleed_height_in"
  >,
  design: {
    background_color: string | null;
    image_url: string | null;
    image_x: number;
    image_y: number;
    image_scale: number;
    text_font_size: number;
    text_align: "left" | "center" | "right";
  },
  hasQuestionText: boolean
): DesignLayer[] {
  const layers: DesignLayer[] = [];
  if (design.image_url) {
    layers.push(
      createImageLayer(design.image_url, {
        x: design.image_x - design.image_scale / 2,
        y: design.image_y - design.image_scale / 2,
        width: design.image_scale,
        height: design.image_scale,
      })
    );
  }
  if (hasQuestionText) {
    const guides = computeGuideRects(template);
    const x = guides.safe.insetXPct / 100;
    const y = guides.safe.insetYPct / 100;
    layers.push(
      createTextLayer({
        source: "question",
        x,
        y,
        width: 1 - 2 * x,
        height: 1 - 2 * y,
        fontSize: design.text_font_size,
        align: design.text_align,
        color: readableTextColor(design.background_color),
      })
    );
  }
  return layers;
}

/** Kollekció-hátlap ugyanerre — nincs "question" forrású szöveg, mert
 * a hátlaphoz nincs kártyánkénti szöveg. */
export function legacyBackToLayers(
  design: {
    background_color: string | null;
    image_url: string | null;
    image_x: number;
    image_y: number;
    image_scale: number;
  }
): DesignLayer[] {
  if (!design.image_url) return [];
  return [
    createImageLayer(design.image_url, {
      x: design.image_x - design.image_scale / 2,
      y: design.image_y - design.image_scale / 2,
      width: design.image_scale,
      height: design.image_scale,
    }),
  ];
}

/** Igazítási segédvonalak (snapping) — a vászon közepéhez és széleihez,
 * illetve a safe-zóna széleihez húzza az elmozdított/átméretezett réteg
 * szélét, ha az elég közel kerül hozzájuk. `value` és a visszatérési
 * érték is 0-1 közötti tört. */
export function snapValue(value: number, targets: number[], thresholdFraction = 0.015): number {
  for (const target of targets) {
    if (Math.abs(value - target) <= thresholdFraction) return target;
  }
  return value;
}
