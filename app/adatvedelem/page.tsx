import type { Metadata } from "next";
import Link from "next/link";
import LandingMark from "@/components/LandingMark";
import LegalDocumentContent from "@/components/LegalDocumentContent";
import { getSupabasePublicClient } from "@/lib/supabase/publicClient";
import { formatDate } from "@/lib/format";
import { LEGAL_PAGE_T, isLegalPageLang, type LegalPageLang } from "@/lib/legal-page-i18n";
import "../landing/landing.css";

export const metadata: Metadata = { title: "Adatvédelem — Zusammen" };

// See app/impresszum/page.tsx's comment — same reasoning, forces a
// fresh legal_documents read on every request instead of a build-time
// snapshot.
export const dynamic = "force-dynamic";

/** Public, unauthenticated legal page — see app/impresszum/page.tsx's
 * comment for the full story (same route-vs-slug reasoning applies
 * here). Optional "?lang=de"/"?lang=en" renders the matching
 * content_de/content_en column (see lib/supabase/types.ts's
 * LegalDocument comment) — without it, this stays the magyar default,
 * exactly as before. The back-link points at /first20, the only
 * remaining public-facing page, now that /landing is gone. */
export default async function AdatvedelemPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: langParam } = await searchParams;
  const lang: LegalPageLang = isLegalPageLang(langParam) ? langParam : "hu";
  const t = LEGAL_PAGE_T[lang];

  const supabase = getSupabasePublicClient();
  const { data } = supabase
    ? await supabase.from("legal_documents").select("*").eq("type", "Adatvédelem").maybeSingle()
    : { data: null };

  const title = (lang === "de" ? data?.title_de : lang === "en" ? data?.title_en : data?.title) ?? t.privacyTitle;
  const content = lang === "de" ? data?.content_de : lang === "en" ? data?.content_en : data?.content;

  return (
    <div className="landing-root">
      <div className="legal-page">
        <Link href="/first20" className="back">
          {t.back}
        </Link>
        <LandingMark size={64} />
        <h1>{title}</h1>
        {data?.last_updated && (
          <p className="updated">
            {t.updated}: {formatDate(data.last_updated)}
          </p>
        )}
        {content ? <LegalDocumentContent content={content} /> : <p>{t.notYetAvailable}</p>}
        <p>
          {t.seeAlso}:{" "}
          <Link href={lang === "hu" ? "/impresszum" : `/impresszum?lang=${lang}`} className="inline">
            {t.impressumTitle}
          </Link>
        </p>
      </div>
    </div>
  );
}
