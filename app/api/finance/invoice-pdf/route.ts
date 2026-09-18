import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { SwissQRBill, Table } from "swissqrbill/pdf";
import { isQRIBAN, calculateQRReferenceChecksum } from "swissqrbill/utils";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { formatMoney } from "@/lib/currency";
import type { CurrencyCode } from "@/lib/supabase/types";

// PDF generation needs a real Node.js runtime (pdfkit/swissqrbill aren't
// edge-compatible) — same reasoning as /api/card-assets/process.
export const runtime = "nodejs";
export const maxDuration = 30;

// This route isn't excluded from proxy.ts's matcher, so it's only ever
// reachable with a valid Supabase Auth session already — the founder
// clicking "PDF letöltése" on the Számlázás fülön. The service-role
// client is still the right choice (not the anon key) for the same
// reason as /api/card-assets/process: this server-to-server request
// doesn't carry the browser's session JWT through to Postgres the way
// the browser's own client does, and invoices/invoice_items now both
// require auth.uid().
//
// PDFKit's built-in Helvetica only covers WinAnsiEncoding (Latin-1) —
// it renders á/é/í/ó/ö/ú/ü fine but has no glyph for the Hungarian
// double-acute ő/ű, and throws rather than silently dropping them. None
// of the app's bundled fonts (all .woff2) load in this pdfkit/fontkit
// version, so rather than embedding a font just for this, every string
// that goes into the PDF or into the QR-bill payload is sanitized down
// to the closest Latin-1 character first.
function sanitizeLatin1(text: string): string {
  return text.replace(/ő/g, "ö").replace(/Ő/g, "Ö").replace(/ű/g, "ü").replace(/Ű/g, "Ü");
}

// A QR-IBAN (an IBAN whose IID falls in the 30000-31999 range) legally
// requires a QR-reference on every bill — swissqrbill throws rather
// than silently omitting one. A plain (non-QR) IBAN has no such
// requirement, so this is skipped entirely for the common case. There's
// no separate "customer number" concept in this app to build a
// meaningful reference from, so it's derived deterministically from the
// invoice_number itself (its digits, zero-padded to the required 26,
// plus the mandatory mod10 check digit) — stable and unique per invoice
// without needing to store anything extra.
function qrReferenceFor(invoiceNumber: string): string {
  const digits = invoiceNumber.replace(/\D/g, "").padStart(26, "0").slice(-26);
  return digits + calculateQRReferenceChecksum(digits);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Hiányzó 'id' paraméter." }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  const [invoiceRes, itemsRes, settingsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position", { ascending: true }),
    supabase.from("company_settings").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (invoiceRes.error || !invoiceRes.data) {
    return NextResponse.json({ error: "Számla nem található." }, { status: 404 });
  }
  if (itemsRes.error) {
    return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
  }
  const invoice = invoiceRes.data;
  const items = itemsRes.data ?? [];
  const settings = settingsRes.data;

  if (!settings?.iban || !settings.billing_street || !settings.billing_zip || !settings.billing_city) {
    return NextResponse.json(
      {
        error:
          "Hiányzó számlázási adatok — töltsd ki a Beállítások → Számlázási adatok kártyán az IBAN-t és a kiállítói címet (utca, irányítószám, város), mielőtt PDF-et generálnál.",
      },
      { status: 400 }
    );
  }
  if (invoice.currency !== "CHF" && invoice.currency !== "EUR") {
    return NextResponse.json(
      { error: "A svájci QR-számla csak CHF vagy EUR pénznemben állítható ki — ellenőrizd a számla pénznemét." },
      { status: 400 }
    );
  }
  // Narrowed right at the check above — swissqrbill's Data.currency is
  // "CHF" | "EUR" only, stricter than the app-wide CurrencyCode (which
  // also allows USD, ruled out just above).
  const qrCurrency = invoice.currency;

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const companyName = sanitizeLatin1(settings.company_name || "Zusammen");

  doc.fontSize(18).text(companyName, { continued: false });
  doc.fontSize(9).fillColor("#666666");
  if (settings.billing_street) doc.text(sanitizeLatin1(settings.billing_street));
  doc.text(`${settings.billing_zip ?? ""} ${sanitizeLatin1(settings.billing_city ?? "")}`.trim());
  doc.fillColor("#000000");

  doc.moveDown(2);
  doc.fontSize(20).text(`Számla ${invoice.invoice_number}`);
  doc.fontSize(10).fillColor("#666666");
  doc.text(`Kiállítás dátuma: ${invoice.issue_date}`);
  if (invoice.due_date) doc.text(`Fizetési határidő: ${invoice.due_date}`);
  doc.fillColor("#000000");

  doc.moveDown(1);
  doc.fontSize(11).text("Vevő:");
  doc.fontSize(10).text(sanitizeLatin1(invoice.customer_name));
  if (invoice.customer_address) doc.text(sanitizeLatin1(invoice.customer_address));

  doc.moveDown(1.5);

  const currency = invoice.currency as CurrencyCode;
  const table = new Table({
    rows: [
      {
        header: true,
        backgroundColor: "#f0ece0",
        fontSize: 9,
        columns: [
          { text: "Megnevezés", width: 260 },
          { text: "Menny.", width: 60, align: "right" },
          { text: "Egységár", width: 90, align: "right" },
          { text: "Összesen", width: 90, align: "right" },
        ],
      },
      ...items.map((item) => ({
        fontSize: 9,
        columns: [
          { text: sanitizeLatin1(item.description), width: 260 },
          { text: item.quantity, width: 60, align: "right" as const },
          { text: formatMoney(item.unit_price, currency), width: 90, align: "right" as const },
          { text: formatMoney(item.quantity * item.unit_price, currency), width: 90, align: "right" as const },
        ],
      })),
      {
        fontSize: 10,
        borderWidth: [1, 0, 0, 0],
        columns: [
          { text: "", width: 260 },
          { text: "", width: 60 },
          { text: "Végösszeg", width: 90, align: "right" },
          { text: formatMoney(totalAmount, currency), width: 90, align: "right" },
        ],
      },
    ],
  });
  table.attachTo(doc);

  if (invoice.notes) {
    doc.moveDown(1.5);
    doc.fontSize(9).fillColor("#666666").text(sanitizeLatin1(invoice.notes));
    doc.fillColor("#000000");
  }

  // The QR-bill payment part is a fixed A6-sized slip at the bottom of
  // the page (or its own page if there's no room left). A reference is
  // only mandatory when the IBAN itself is a QR-IBAN — see qrReferenceFor
  // above; a plain IBAN is issued without one ("NON" reference type).
  const qrBill = new SwissQRBill(
    {
      currency: qrCurrency,
      amount: totalAmount,
      creditor: {
        name: companyName,
        address: sanitizeLatin1(settings.billing_street),
        zip: settings.billing_zip,
        city: sanitizeLatin1(settings.billing_city),
        country: settings.billing_country || "CH",
        account: settings.iban,
      },
      ...(isQRIBAN(settings.iban) ? { reference: qrReferenceFor(invoice.invoice_number) } : {}),
      message: sanitizeLatin1(`Számla ${invoice.invoice_number}`),
    },
    { language: "DE" }
  );
  qrBill.attachTo(doc);

  doc.end();
  const buffer = await finished;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="szamla-${invoice.invoice_number}.pdf"`,
    },
  });
}
