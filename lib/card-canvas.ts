import type { CardTemplate } from "./supabase/types";

/**
 * A márka szín-palettája a kártyák hátteréhez — külön a dashboard saját
 * UI-színeitől (app/globals.css), mert egy nyomtatott kártya
 * színvilága nem feltétlenül ugyanaz, mint a dashboard chrome-ja.
 * Csak kiinduló javaslatok: a szerkesztőben egyedi szín is választható
 * (natív color picker), ez a nyolc csak gyors hozzáférést ad a
 * visszatérő márka-színekhez.
 */
export const CARD_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Forest", hex: "#233328" },
  { name: "Pine", hex: "#2E4B3B" },
  { name: "Ivory", hex: "#F3EFE7" },
  { name: "Gold", hex: "#C9A227" },
  { name: "Walnut", hex: "#7A5A3B" },
  { name: "Burgundy", hex: "#5C1A24" },
  { name: "Lake", hex: "#3E6472" },
  { name: "Coffee", hex: "#4A3428" },
];

export const DEFAULT_CARD_BACKGROUND = "#F3EFE7";

export interface GuideRect {
  /** A vászon (bleed terület) szélétől való behúzás, százalékban — bal/jobb. */
  insetXPct: number;
  /** A vászon szélétől való behúzás, százalékban — fent/lent. */
  insetYPct: number;
}

/**
 * A cut- és safe-vonal pozíciója a bleed vászonhoz képest, százalékban
 * kifejezve — ez teszi lehetővé, hogy a szerkesztő élő előnézete pusztán
 * CSS `inset` értékekkel rajzolja ki a három zónát, a sablon tényleges
 * hüvelyk-méreteitől függetlenül. Feltételezi, hogy a cut/safe/bleed
 * koncentrikus, középre igazított téglalapok — ez a QPMN Skat Size
 * megadott számaiból is következik (mindkét oldalon egyenlő a
 * ráhagyás), és minden nyomdai sablonnál ez a szokásos elrendezés.
 */
export function computeGuideRects(
  template: Pick<CardTemplate, "cut_width_in" | "cut_height_in" | "safe_width_in" | "safe_height_in" | "bleed_width_in" | "bleed_height_in">
): { cut: GuideRect; safe: GuideRect } {
  function inset(targetWidthIn: number, targetHeightIn: number): GuideRect {
    return {
      insetXPct: ((template.bleed_width_in - targetWidthIn) / 2 / template.bleed_width_in) * 100,
      insetYPct: ((template.bleed_height_in - targetHeightIn) / 2 / template.bleed_height_in) * 100,
    };
  }
  return {
    cut: inset(template.cut_width_in, template.cut_height_in),
    safe: inset(template.safe_width_in, template.safe_height_in),
  };
}

/**
 * Fehér vagy sötét szöveg olvashatóbb-e egy adott háttérszínen —
 * egyszerű relatív-fényesség heurisztika, hogy a szövegdoboz szövege ne
 * kelljen külön beállítani, automatikusan kontrasztos maradjon bármelyik
 * márka-színen (a sötét Forest/Pine/Burgundy/Coffee háttéren fehér, a
 * világos Ivory/Gold/Lake háttéren sötét).
 */
export function readableTextColor(backgroundHex: string | null): string {
  if (!backgroundHex) return "#233328";
  const clean = backgroundHex.replace("#", "");
  if (clean.length !== 6) return "#233328";
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#233328" : "#FFFFFF";
}
