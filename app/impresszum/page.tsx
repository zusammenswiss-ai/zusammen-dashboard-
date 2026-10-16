import type { Metadata } from "next";
import Link from "next/link";
import LandingMark from "@/components/LandingMark";
import LegalDocumentContent from "@/components/LegalDocumentContent";
import { getSupabasePublicClient } from "@/lib/supabase/publicClient";
import { formatDate } from "@/lib/format";
import { LEGAL_PAGE_T, isLegalPageLang, type LegalPageLang } from "@/lib/legal-page-i18n";
import "../landing/landing.css";

export const metadata: Metadata = { title: "Impresszum — Zusammen" };

// Without this, Next.js would prerender the page once at build time and
// bake in whatever legal_documents.content was at that moment — an edit
// made afterwards in Beállítások wouldn't show up until the next deploy.
// Forcing dynamic rendering means every request reads the live row.
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated legal page — content lives in the
 * legal_documents table (Beállítások → Jogi dokumentumok), not baked
 * into this file, so the founder can edit and lock it without a code
 * change. This route is a fixed Next.js folder rather than a slug-
 * driven catch-all: it always renders whichever row has
 * type = 'Impresszum', regardless of what that row's own `slug` field
 * is currently set to — `slug` only drives what OTHER pages link to it
 * with (see lib/legal-links.ts), not where this page itself lives. Also
 * excluded from proxy.ts's auth gate (same matcher entry as `landing`).
 * Optional "?lang=de"/"?lang=en" — see app/adatvedelem/page.tsx's
 * comment for the full story. The back-link points at /first20, the
 * only remaining public-facing page, now that /landing is gone. */
export default async function ImpresszumPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: langParam } = await searchParams;
  const lang: LegalPageLang = isLegalPageLang(langParam) ? langParam : "hu";
  const t = LEGAL_PAGE_T[lang];

  const supabase = getSupabasePublicClient();
  const { data } = supabase
    ? await supabase.from("legal_documents").select("*").eq("type", "Impresszum").maybeSingle()
    : { data: null };

  const title = (lang === "de" ? data?.title_de : lang === "en" ? data?.title_en : data?.title) ?? t.impressumTitle;
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
          <Link href={lang === "hu" ? "/adatvedelem" : `/adatvedelem?lang=${lang}`} className="inline">
            {t.privacyTitle}
          </Link>
        </p>
      </div>
    </div>
  );
}
