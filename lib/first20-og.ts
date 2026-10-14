// Open Graph / Twitter Card copy for /first20 — separate from
// first20-i18n.ts for the same reason landing-og.ts is separate from
// landing-i18n.ts: social-preview text is shorter/punchier than the
// on-page copy, and OG locale codes live here next to it.
import type { First20Lang } from "./first20-i18n";

export const FIRST20_OG_TITLE: Record<First20Lang, string> = {
  de: "Zusammen — First 20",
  hu: "Zusammen — First 20",
  en: "Zusammen — First 20",
};

export const FIRST20_OG_DESCRIPTION: Record<First20Lang, string> = {
  de: "20 Paare. Ein Kartenspiel. Ein Abend ohne Handys — sichert euch euren Platz.",
  hu: "20 pár. Egy kártyapakli. Egy este telefon nélkül — foglaljátok le a helyeteket.",
  en: "20 couples. One card deck. One evening without phones — claim your spot.",
};

export const FIRST20_OG_LOCALE: Record<First20Lang, string> = {
  de: "de_CH",
  hu: "hu_HU",
  en: "en_US",
};
