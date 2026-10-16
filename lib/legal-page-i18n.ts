// Small UI-label translations for the public /impresszum and
// /adatvedelem pages — the pages read this so a visitor who arrives via
// "?lang=de"/"?lang=en" (e.g. from the current language on /first20)
// sees a fully German/English page, not just translated legal body text
// inside an otherwise-Hungarian frame. The legal body text itself lives
// in legal_documents.content/content_de/content_en (see
// supabase/schema.sql and lib/supabase/types.ts's LegalDocument
// comment) — this file is only the handful of surrounding chrome
// strings (back-link, "see also", "last updated", …).
export type LegalPageLang = "hu" | "de" | "en";

export function isLegalPageLang(value: string | undefined | null): value is LegalPageLang {
  return value === "hu" || value === "de" || value === "en";
}

type LegalPageT = {
  back: string;
  updated: string;
  notYetAvailable: string;
  seeAlso: string;
  privacyTitle: string;
  impressumTitle: string;
};

export const LEGAL_PAGE_T: Record<LegalPageLang, LegalPageT> = {
  hu: {
    back: "← Vissza a ZUSAMMEN-hez",
    updated: "Utolsó módosítás",
    notYetAvailable: "A tartalom hamarosan elérhető.",
    seeAlso: "Lásd még",
    privacyTitle: "Adatvédelmi tájékoztató",
    impressumTitle: "Impresszum",
  },
  de: {
    back: "← Zurück zu ZUSAMMEN",
    updated: "Letzte Änderung",
    notYetAvailable: "Der Inhalt ist bald verfügbar.",
    seeAlso: "Siehe auch",
    privacyTitle: "Datenschutzerklärung",
    impressumTitle: "Impressum",
  },
  en: {
    back: "← Back to ZUSAMMEN",
    updated: "Last updated",
    notYetAvailable: "Content coming soon.",
    seeAlso: "See also",
    privacyTitle: "Privacy notice",
    impressumTitle: "Imprint",
  },
};
