import { ImageResponse } from "next/og";
import { FIRST20_OG_TITLE, FIRST20_OG_DESCRIPTION } from "@/lib/first20-og";
import { isFirst20Lang, type First20Lang } from "@/lib/first20-i18n";

// Branded OG/Twitter preview for /first20 — a vector card-fan (no real
// product photography exists yet, see app/first20/page.tsx's own
// comment) rendered directly in satori, so it never depends on a signed
// Supabase Storage URL that could expire out from under a cached social
// preview.
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
  walnut: "#7a5a3b",
};

// Same recipe as app/api/og/route.tsx — pulls a real TTF/OTF out of
// Google Fonts (the `text` param forces a single-file response instead
// of a WOFF2 variable font, which next/og can't parse).
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

function FanCard({ rotate, translateX, fill }: { rotate: number; translateX: number; fill: string }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 150,
        height: 220,
        borderRadius: 14,
        background: fill,
        border: `2px solid ${PALETTE.gold}`,
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translateX(${translateX}px) rotate(${rotate}deg)`,
        boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
      }}
    />
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const langParam = searchParams.get("lang");
  const lang: First20Lang = isFirst20Lang(langParam) ? langParam : "de";

  const title = FIRST20_OG_TITLE[lang];
  const description = FIRST20_OG_DESCRIPTION[lang];
  const fontText = `${title}${description}ZUSAMMEN FIRST 20`;
  const frauncesData = await loadFrauncesFont(fontText);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PALETTE.forest,
          fontFamily: frauncesData ? "Fraunces" : undefined,
        }}
      >
        {/* Left: brand + copy */}
        <div
          style={{
            width: "58%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 0 72px 80px",
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 5,
              color: PALETTE.gold,
              textTransform: "uppercase",
            }}
          >
            Zusammen · First 20
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 560 }}>
            <span style={{ fontSize: 52, lineHeight: 1.2, color: PALETTE.ivory, fontWeight: 600 }}>{title}</span>
            <span style={{ fontSize: 26, color: PALETTE.linen, fontWeight: 400 }}>{description}</span>
          </div>
          <span style={{ fontSize: 20, color: PALETTE.sand, letterSpacing: 2 }}>das-zusammen.ch</span>
        </div>

        {/* Right: vector card fan */}
        <div style={{ width: "42%", height: "100%", position: "relative", display: "flex" }}>
          <FanCard rotate={-14} translateX={-40} fill={PALETTE.pine} />
          <FanCard rotate={0} translateX={0} fill={PALETTE.walnut} />
          <FanCard rotate={14} translateX={40} fill={PALETTE.bronze} />
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
