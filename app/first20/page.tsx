import type { Metadata } from "next";
import { FIRST20_LANGS, isFirst20Lang, type First20Lang } from "@/lib/first20-i18n";
import { FIRST20_OG_TITLE, FIRST20_OG_DESCRIPTION, FIRST20_OG_LOCALE } from "@/lib/first20-og";
import { SITE_URL } from "@/lib/site-url";
import { getSupabasePublicClient } from "@/lib/supabase/publicClient";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { legalDocumentUrl } from "@/lib/legal-links";
import First20Client from "./First20Client";

// Mirrors app/landing/page.tsx's reasoning for keeping generateMetadata
// at the page level (not a shared layout, since layouts don't get
// searchParams) — see the comment there. /first20 has 3 real on-page
// languages (hu/de/en) instead of /landing's 2, otherwise same shape.
function ogImageUrl(lang: First20Lang) {
  return `${SITE_URL}/api/og/first20?lang=${lang}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang: langParam } = await searchParams;
  const lang: First20Lang = isFirst20Lang(langParam) ? langParam : "de";

  const description = FIRST20_OG_DESCRIPTION[lang];
  const canonicalPath = lang === "de" ? "/first20" : `/first20?lang=${lang}`;
  const image = { url: ogImageUrl(lang), width: 1200, height: 630, alt: FIRST20_OG_TITLE[lang] };

  return {
    title: FIRST20_OG_TITLE[lang],
    description,
    alternates: {
      canonical: canonicalPath,
      languages: Object.fromEntries(FIRST20_LANGS.map((l) => [l, `/first20?lang=${l}`])),
    },
    openGraph: {
      type: "website",
      title: FIRST20_OG_TITLE[lang],
      description,
      url: canonicalPath,
      siteName: "Zusammen",
      locale: FIRST20_OG_LOCALE[lang],
      alternateLocale: FIRST20_LANGS.filter((l) => l !== lang).map((l) => FIRST20_OG_LOCALE[l]),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: FIRST20_OG_TITLE[lang],
      description,
      images: [image.url],
    },
  };
}

// Service-role, not the public anon client — first20_signups has no
// public/anon SELECT policy (see supabase/schema.sql), only "name +
// email exists" data, so the public page only ever learns the COUNT,
// server-side, never the rows themselves.
async function getSignupCount(): Promise<number> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return 0;
  const { count } = await supabase.from("first20_signups").select("id", { count: "exact", head: true });
  return count ?? 0;
}

async function getPrivacyHref(): Promise<string> {
  const supabase = getSupabasePublicClient();
  return legalDocumentUrl(supabase, "Adatvédelem");
}

// force-dynamic: the signup counter must reflect real data on every
// request, not a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function First20Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; utm_source?: string; utm_medium?: string }>;
}) {
  const { lang: langParam, utm_source, utm_medium } = await searchParams;
  const initialLang: First20Lang = isFirst20Lang(langParam) ? langParam : "de";
  const [signupCount, privacyHref] = await Promise.all([getSignupCount(), getPrivacyHref()]);

  return (
    <First20Client
      initialLang={initialLang}
      signupCount={signupCount}
      privacyHref={privacyHref}
      utmSource={utm_source ?? null}
      utmMedium={utm_medium ?? null}
    />
  );
}
