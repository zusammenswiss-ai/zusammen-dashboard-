import type { Metadata } from "next";
import type { LandingLang } from "@/lib/landing-i18n";
import { OG_TITLE, OG_DESCRIPTION, OG_LOCALE, isOgLang, OG_LANGS, type OgLang } from "@/lib/landing-og";
import { SITE_URL } from "@/lib/site-url";
import { getSupabasePublicClient } from "@/lib/supabase/publicClient";
import LandingClient from "./LandingClient";

// generateMetadata only lives here — not in a shared app/landing/layout.tsx
// — deliberately: a layout wraps every route under /landing/* (impressum,
// datenschutz too), but layouts also don't receive `searchParams` at all,
// so a layout couldn't read ?lang= in the first place. Page-level
// metadata applies to exactly this route and nothing else, which is
// what's wanted here anyway.
function ogImageUrl(lang: OgLang) {
  return `${SITE_URL}/api/og?lang=${lang}`;
}

// /landing itself is a single-URL, client-side DE/EN toggle (see
// LandingClient.tsx) rather than separate localized routes, so there's no
// URL to hand a crawler that's inherently "the English version". ?lang=
// is the bridge: optional (bare /landing keeps behaving exactly as
// before, defaulting to German), but a link built as /landing?lang=en
// both opens the page pre-set to English (passed down as initialLang
// below) and gets its own English OG/Twitter preview here — which is
// what "linkeld be nyelvenként, ha az oldal nyelvet vált" is asking for
// without a full localized-routing rewrite.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang: langParam } = await searchParams;
  const lang: OgLang = isOgLang(langParam) ? langParam : "de";

  const description = OG_DESCRIPTION[lang];
  const canonicalPath = lang === "de" ? "/landing" : `/landing?lang=${lang}`;
  const image = {
    url: ogImageUrl(lang),
    width: 1200,
    height: 630,
    alt: OG_TITLE,
  };

  return {
    title: OG_TITLE,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: Object.fromEntries(OG_LANGS.map((l) => [l, `/landing?lang=${l}`])),
    },
    openGraph: {
      type: "website",
      title: OG_TITLE,
      description,
      url: canonicalPath,
      siteName: "Zusammen",
      locale: OG_LOCALE[lang],
      alternateLocale: OG_LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: OG_TITLE,
      description,
      images: [image.url],
    },
  };
}

// Legal-footer hrefs read live from legal_documents.slug (Beállítások →
// Jogi dokumentumok) instead of the hardcoded /landing/impressum and
// /landing/datenschutz paths this used to link to — falls back to the
// current default slugs if Supabase isn't configured or the seed rows
// aren't there yet, so the footer links never break outright.
async function legalFooterHrefs(): Promise<{ impressumHref: string; datenschutzHref: string }> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return { impressumHref: "/impresszum", datenschutzHref: "/adatvedelem" };
  const { data } = await supabase.from("legal_documents").select("type, slug");
  const slugByType = new Map((data ?? []).map((row) => [row.type, row.slug]));
  return {
    impressumHref: `/${slugByType.get("Impresszum") ?? "impresszum"}`,
    datenschutzHref: `/${slugByType.get("Adatvédelem") ?? "adatvedelem"}`,
  };
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: langParam } = await searchParams;
  // Only "de"/"en" are real on-page languages (see landing-i18n.ts) — a
  // ?lang=hu OG-preview link still opens the actual funnel in German.
  const initialLang: LandingLang = langParam === "en" ? "en" : "de";
  const { impressumHref, datenschutzHref } = await legalFooterHrefs();
  return <LandingClient initialLang={initialLang} impressumHref={impressumHref} datenschutzHref={datenschutzHref} />;
}
