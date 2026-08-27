// Open Graph / Twitter Card copy for /landing — kept separate from
// landing-i18n.ts because it needs a Hungarian variant too (for the OG
// preview only; the landing page itself has never had Hungarian UI copy,
// see landing-i18n.ts), and because social-preview text is deliberately
// shorter/punchier than the on-page copy it's drawn from.
export type OgLang = "de" | "en" | "hu";
export const OG_LANGS: OgLang[] = ["de", "en", "hu"];

// The bilingual tagline already used verbatim as the hero eyebrow in both
// landingT.de and landingT.en — kept identical across all three OG
// variants per spec rather than translated, since it's the brand line.
export const OG_TITLE = "Zusammen — Where conversations become memories.";

export const OG_DESCRIPTION: Record<OgLang, string> = {
  en: "A card deck built around putting your phone down. Try it now.",
  de: "Ein Kartenspiel, das darauf aufbaut, das Handy wegzulegen. Probier's jetzt aus.",
  hu: "Egy kártyajáték, ami arra épül, hogy leteszed a telefont. Próbáld ki most.",
};

// Small badge text shown on the generated OG image itself, and used for
// og:locale / twitter:locale — Facebook's locale codes want a region
// suffix, hence "de_CH" (Swiss German, matches the brand) rather than
// plain "de".
export const OG_LOCALE: Record<OgLang, string> = {
  de: "de_CH",
  en: "en_US",
  hu: "hu_HU",
};

export function isOgLang(value: string | undefined | null): value is OgLang {
  return value === "de" || value === "en" || value === "hu";
}
