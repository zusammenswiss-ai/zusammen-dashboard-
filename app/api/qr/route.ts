import { NextResponse } from "next/server";
import QRCode from "qrcode";

// GET /api/qr?url=... — renders a PNG QR code for the Megosztások page's
// "Megosztható link és QR kód" section. Generated server-side (the
// `qrcode` package, pure JS, no native deps) instead of depending on a
// third-party QR API — keeps this self-contained and working offline in
// dev, same reasoning as /api/og generating its own preview image
// instead of screenshotting something external.
//
// The caller builds `url` from window.location.origin (see
// ShareLinkSection.tsx) rather than SITE_URL, so it always matches
// whatever domain the founder is actually browsing from — custom
// domain, a Vercel preview URL, or localhost — there's deliberately no
// exact-origin allowlist here for that reason. What's restricted is the
// *path*: only /landing, so this never becomes a general "QR-code any
// URL" service.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) {
    return NextResponse.json({ ok: false, error: "Hiányzó url paraméter." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen url." }, { status: 400 });
  }
  if (parsed.pathname !== "/landing") {
    return NextResponse.json({ ok: false, error: "Csak a /landing oldal osztható meg QR kóddal." }, { status: 400 });
  }

  try {
    const png = await QRCode.toBuffer(target, {
      type: "png",
      width: 512,
      margin: 2,
      color: {
        dark: "#233328", // --forest, matches the brand palette
        light: "#00000000", // transparent, sits nicely on any background
      },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Nem sikerült előállítani a QR kódot." }, { status: 500 });
  }
}
