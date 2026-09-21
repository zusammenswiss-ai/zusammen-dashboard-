import type { CardTemplate, CollectionCard, CollectionCardType } from "./supabase/types";

/**
 * A gyártói sablon (bleed/cut/safe méretek hüvelykben + DPI) belőle
 * számolt pixelméretei — az exportnak (Kártyatervező 3. fázis) pontosan
 * ezt a bleed pixelméretet kell renderelnie, a Sablonok listán pedig
 * csak megjelenítjük, hogy a founder egy pillantással lássa, mekkora
 * fájlt fog kapni a gyártó.
 */
export function templatePixelDims(template: Pick<CardTemplate, "bleed_width_in" | "bleed_height_in" | "dpi">) {
  return {
    width: Math.round(template.bleed_width_in * template.dpi),
    height: Math.round(template.bleed_height_in * template.dpi),
  };
}

export function formatTemplatePixelDims(template: Pick<CardTemplate, "bleed_width_in" | "bleed_height_in" | "dpi">) {
  const { width, height } = templatePixelDims(template);
  return `${width}×${height} px @ ${template.dpi} DPI`;
}

/**
 * "Automatikus azonosító" gomb logikája — a founder saját formátumot
 * használ kártyatípusonként, ez csak egy ésszerű javaslat, amit még
 * elküldés előtt felül lehet írni: Wild Card-nál "Wild Card N", Gold
 * Card-nál "Gold Card" (majd "Gold Card 2" stb., ha már van egy), minden
 * másnál a legnagyobb már használt tisztán numerikus sorszám + 1.
 */
export function suggestCardNumber(
  existing: { card_number: string; card_type: CollectionCardType }[],
  cardType: CollectionCardType
): string {
  const sameType = existing.filter((c) => c.card_type === cardType);

  if (cardType === "Wild Card") {
    const nums = sameType
      .map((c) => /^Wild Card (\d+)$/.exec(c.card_number)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number);
    return `Wild Card ${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;
  }

  if (cardType === "Gold Card") {
    return sameType.some((c) => c.card_number === "Gold Card") ? `Gold Card ${sameType.length + 1}` : "Gold Card";
  }

  const nums = sameType
    .map((c) => (/^\d+$/.test(c.card_number) ? Number(c.card_number) : null))
    .filter((n): n is number => n != null);
  return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
}

/** Egy kártya nyelvenkénti szövege — csak HU/DE/EN oszlop létezik
 * (lásd a collection_cards sémáját), egy tetszőleges egyéni nyelv-kód
 * (Kollekció adatai → Nyelvek) így nem kap saját szöveg-mezőt; ugyanez
 * a korlát, mint a kártya-form (CollectionDetailModal cardFormFields)
 * nyelvenkénti textarea-inál. */
export function textForLanguage(card: Pick<CollectionCard, "text_hu" | "text_de" | "text_en">, lang: string): string {
  if (lang === "HU") return card.text_hu ?? "";
  if (lang === "DE") return card.text_de ?? "";
  if (lang === "EN") return card.text_en ?? "";
  return "";
}
