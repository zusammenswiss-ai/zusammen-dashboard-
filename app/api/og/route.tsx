import { ImageResponse } from "next/og";
import { OG_TITLE, OG_DESCRIPTION, isOgLang, type OgLang } from "@/lib/landing-og";

// Branded placeholder OG/Twitter preview image for /landing, generated on
// request rather than shipped as a static file — there's no real
// promotional photography yet, so this stands in until there is (swap it
// out later by pointing app/landing/page.tsx's generateMetadata
// openGraph/twitter image URLs at real files instead of this route).
// ?lang=de|en|hu picks the copy; unknown/missing falls back to "de" to
// match the landing page's own default language.
//
// Edge runtime is deprecated as of Next 16 — nodejs handles ImageResponse
// fine, nothing here needs anything edge-specific.
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

const PALETTE = {
  forest: "#233328",
  pine: "#314537",
  ivory: "#f3efe7",
  linen: "#ddd3c4",
  sand: "#c8b79d",
  bronze: "#b08a52",
  gold: "#c8a96b",
};

const LANG_LABEL: Record<OgLang, string> = { de: "DE", en: "EN", hu: "HU" };

// Vercel's documented recipe for pulling a real (TTF/OTF) font file out of
// Google Fonts for use in ImageResponse — the `text` param makes Google
// return a minimal, single-file CSS response instead of a WOFF2 variable
// font, which `next/og` can't parse. Falls back to no custom font (satori's
// bundled default) if this ever fails, so a network hiccup degrades the
// look rather than breaking the image entirely.
async function loadFrauncesFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Fraunces:wght@600&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const langParam = searchParams.get("lang");
  const lang: OgLang = isOgLang(langParam) ? langParam : "de";

  const description = OG_DESCRIPTION[lang];
  const fontText = `${OG_TITLE}${description}ZUSAMMEN${LANG_LABEL[lang]}`;
  const frauncesData = await loadFrauncesFont(fontText);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: `linear-gradient(135deg, ${PALETTE.forest} 0%, ${PALETTE.pine} 100%)`,
          fontFamily: frauncesData ? "Fraunces" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Static (non-animated) render of the LandingMark mountain+heart
           * brand mark — same path data, just without the Framer Motion
           * draw-in, which needs a real DOM and doesn't run in this
           * satori-based image renderer. */}
          <svg width={72} height={36} viewBox="0 0 200 100" fill="none">
            <path
              d="M8 74 L34 36 L47 52 L60 22 L73 45 L86 18 L99 45 L112 22 L125 52 L138 36 L164 74"
              stroke={PALETTE.gold}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M88 21c-3.5-5-11-4.5-11 2 0 6 11 12 11 12s11-6 11-12c0-6.5-7.5-7-11-2Z"
              stroke={PALETTE.gold}
              strokeWidth={6}
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: 6,
              color: PALETTE.ivory,
              textTransform: "uppercase",
            }}
          >
            Zusammen
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 980 }}>
          <span
            style={{
              fontSize: 60,
              lineHeight: 1.15,
              color: PALETTE.ivory,
              fontWeight: 600,
            }}
          >
            Where conversations become memories.
          </span>
          <span style={{ fontSize: 30, color: PALETTE.linen, fontWeight: 400 }}>{description}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 22, color: PALETTE.sand, letterSpacing: 2 }}>zusammen.swiss</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: 3,
              color: PALETTE.forest,
              background: PALETTE.bronze,
              padding: "6px 18px",
              borderRadius: 999,
            }}
          >
            {LANG_LABEL[lang]}
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: frauncesData ? [{ name: "Fraunces", data: frauncesData, weight: 600, style: "normal" }] : undefined,
    }
  );
}
