// Shared "where does the live Impresszum/Adatvédelem page point to
// right now" lookup — reads legal_documents.slug so every consumer
// (campaign emails' {{privacy_link}}, the /landing footer) stays in
// sync if the slug is ever edited in Beállítások, instead of each
// hardcoding its own URL string. Falls back to the known-good default
// path when the table/row isn't there yet (fresh install before
// schema.sql's seed has run, or Supabase not configured) so nothing
// breaks silently — see app/impresszum/page.tsx's own comment for why
// the page's *route* stays fixed even though this link can drift.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LegalDocumentType } from "./supabase/types";
import { SITE_URL } from "./site-url";

const DEFAULT_SLUG: Record<LegalDocumentType, string> = {
  Impresszum: "impresszum",
  Adatvédelem: "adatvedelem",
};

export async function legalDocumentUrl(
  supabase: SupabaseClient<Database> | null,
  type: LegalDocumentType
): Promise<string> {
  if (supabase) {
    const { data } = await supabase.from("legal_documents").select("slug").eq("type", type).maybeSingle();
    if (data?.slug) return `${SITE_URL}/${data.slug}`;
  }
  return `${SITE_URL}/${DEFAULT_SLUG[type]}`;
}
