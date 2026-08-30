import { NextResponse } from "next/server";

// GET /api/finance/exchange-rates — fetched by lib/exchange-rates.ts on
// Pénzügyek/Áttekintés so mixed-currency totals (a USD-quoted COGS
// against a CHF sale price, say) can actually be summed correctly
// instead of just flagging the mismatch. Frankfurter (ECB reference
// rates) is free and needs no API key/signup, matching this app's
// established "no key needed unless truly required" bar — same spirit
// as the self-generated QR codes.
//
// Server-side (not called directly from the browser) so a Frankfurter
// outage can't turn into a CORS error the client has to puzzle out, and
// so the hourly cache below is shared across every visitor instead of
// re-fetched per browser.
const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=CHF&to=USD,EUR";

export async function GET() {
  try {
    const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Árfolyam-szolgáltatás hiba (${res.status}).` }, { status: 502 });
    }
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    if (typeof data.rates?.USD !== "number" || typeof data.rates?.EUR !== "number") {
      return NextResponse.json({ ok: false, error: "Váratlan árfolyam-válasz." }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      date: data.date,
      // "1 CHF equals this many units of X" — CHF is the pivot currency
      // throughout, see lib/exchange-rates.ts's convertAmount.
      ratesFromCHF: { CHF: 1, USD: data.rates.USD, EUR: data.rates.EUR },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Nem sikerült lekérni az árfolyamokat." },
      { status: 502 }
    );
  }
}
