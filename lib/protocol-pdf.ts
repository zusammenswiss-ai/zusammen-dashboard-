// Jegyzőkönyv → PDF export, márka-színekkel (lásd app/globals.css
// --forest/--bronze/--ivory tokenjeit — ugyanazok a hex kódok, csak
// jsPDF nem tud CSS-változót olvasni). Kliens-oldalon fut, ugyanaz a
// jsPDF csomag, amit a Kártyatervező ExportPanel-je is használ.
//
// jsPDF beépített fontjai (helvetica/times/courier) a WinAnsi
// kódolást használják, amiben NINCS "ő"/"ű" (U+0151/U+0171) — ezek a
// karakterek hibásan vagy egyáltalán nem jelennek meg. Ezért a dashboard
// saját, már amúgy is használt brand-fontjait (Inter, Fraunces — lásd
// public/fonts/pdf/) ágyazzuk be a PDF-be, mindkettő teljes magyar
// ékezet-lefedettséggel.
import { jsPDF } from "jspdf";
import type { Protocol } from "@/lib/supabase/types";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { STATS_ROW_LABELS, type WeeklyStatsSnapshot } from "@/lib/weekly-stats";

const FOREST = [35, 51, 40] as const;
const BRONZE = [176, 138, 82] as const;
const WALNUT = [122, 90, 59] as const;
const MUTED = [110, 110, 105] as const;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
// Bronz oldalsáv a lap bal szélén, minden oldalon — ettől a
// folytatólapok (amikor egy hosszú jegyzőkönyv túlcsordul az első
// oldalról) is márkázottnak, nem csupasz szövegdömpingnek tűnnek.
const SIDEBAR_WIDTH = 5;
const FOOTER_Y = 290;

const FONT_FILES: { file: string; name: string; style: "normal" | "bold" }[] = [
  { file: "Inter-Regular.ttf", name: "Inter", style: "normal" },
  { file: "Inter-Bold.ttf", name: "Inter", style: "bold" },
  { file: "Fraunces-Bold.ttf", name: "Fraunces", style: "bold" },
];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

let fontsPromise: Promise<string[]> | null = null;

/** Egyszer tölti le a 3 fontfájlt (base64-ként gyorsítótárazva), aztán
 * minden buildProtocolPdf hívás ugyanazt a base64-et regisztrálja az adott
 * jsPDF példányra — az addFileToVFS/addFont példányonkénti, a letöltés
 * nem, úgyhogy nem kell újra hálózatra menni minden exportnál. */
async function loadFontData(): Promise<string[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONT_FILES.map((f) =>
        fetch(`/fonts/pdf/${f.file}`)
          .then((res) => res.arrayBuffer())
          .then(arrayBufferToBase64)
      )
    );
  }
  return fontsPromise;
}

async function registerBrandFonts(doc: jsPDF): Promise<void> {
  const data = await loadFontData();
  FONT_FILES.forEach((f, i) => {
    doc.addFileToVFS(f.file, data[i]);
    doc.addFont(f.file, f.name, f.style);
  });
}

function isSnapshot(value: Record<string, unknown>): value is WeeklyStatsSnapshot {
  return typeof value.computedAt === "string";
}

/** Bronz csík a lap bal szélén — ugyanaz minden oldalon, a fejléc-sávval
 * (csak az első oldalon) egybeolvadva. */
function decorateSidebar(doc: jsPDF): void {
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, SIDEBAR_WIDTH, PAGE_HEIGHT, "F");
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.8);
  doc.line(SIDEBAR_WIDTH, 0, SIDEBAR_WIDTH, PAGE_HEIGHT);
}

/** Folytatólapok (2. oldaltól) kis futó fejléce — dátum + egy vékony
 * elválasztó vonal, hogy ezek az oldalak se tűnjenek levált,
 * dísztelen szövegtömbnek. */
function addContinuationHeader(doc: jsPDF, protocol: Protocol): number {
  doc.setFont("Inter", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Zusammen — Jegyzőkönyv · ${formatDate(protocol.entry_date)}`, MARGIN, 12);
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 15, PAGE_WIDTH - MARGIN, 15);
  return 24;
}

function startNewPage(doc: jsPDF, protocol: Protocol): number {
  doc.addPage();
  decorateSidebar(doc);
  return addContinuationHeader(doc, protocol);
}

function addSection(doc: jsPDF, protocol: Protocol, y: number, title: string, body: string | null): number {
  if (!body || !body.trim()) return y;
  doc.setFont("Inter", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...FOREST);
  doc.text(title, MARGIN, y);
  y += 6;
  doc.setFont("Inter", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const lines = body.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const bulleted = `•  ${line.trim()}`;
    const wrapped = doc.splitTextToSize(bulleted, CONTENT_WIDTH - 2) as string[];
    for (const w of wrapped) {
      if (y > 280) {
        y = startNewPage(doc, protocol);
      }
      doc.text(w, MARGIN, y);
      y += 5.5;
    }
  }
  return y + 4;
}

export async function buildProtocolPdf(protocol: Protocol): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerBrandFonts(doc);

  // Fejléc — márka-sáv + oldalsáv az első oldalon
  decorateSidebar(doc);
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");
  // A bronz oldalsáv-vonalat a fejléc-sáv után rajzoljuk újra, hogy a
  // sötét sávon is átfusson, látható, egybefüggő kiemelő csíkot adva.
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.8);
  doc.line(SIDEBAR_WIDTH, 0, SIDEBAR_WIDTH, PAGE_HEIGHT);

  doc.setFont("Fraunces", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Zusammen — Jegyzőkönyv", MARGIN, 17);
  doc.setFont("Inter", "normal");
  doc.setFontSize(10);
  doc.setTextColor(230, 230, 230);
  doc.text(formatDate(protocol.entry_date), MARGIN, 23.5);

  let y = 38;

  // Heti statisztika pillanatkép
  const snapshot = protocol.stats_snapshot;
  if (snapshot && isSnapshot(snapshot)) {
    doc.setFont("Inter", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...FOREST);
    doc.text("Heti statisztika pillanatkép", MARGIN, y);
    y += 2;
    doc.setFontSize(8);
    doc.setFont("Inter", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Rögzítve: ${formatDate(snapshot.computedAt)}`, MARGIN, y + 4);
    y += 9;

    doc.setDrawColor(...BRONZE);
    doc.setLineWidth(0.3);
    for (const { key, label } of STATS_ROW_LABELS) {
      if (y > 275) {
        y = startNewPage(doc, protocol);
      }
      const raw = snapshot[key];
      const isMoney = key === "revenueTotal" || key === "expenseTotal";
      const value = isMoney ? formatMoney(raw, snapshot.currency) : String(raw);
      doc.setFont("Inter", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(label, MARGIN, y);
      doc.setFont("Inter", "bold");
      doc.setTextColor(...WALNUT);
      doc.text(value, PAGE_WIDTH - MARGIN, y, { align: "right" });
      y += 6;
      doc.line(MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4);
    }
    y += 6;
  }

  y = addSection(doc, protocol, y, "Megbeszélt témák", protocol.topics);
  y = addSection(doc, protocol, y, "Döntések", protocol.decisions);
  y = addSection(doc, protocol, y, "Kockázatok / figyelmeztetések", protocol.risks);

  if (protocol.action_items.length > 0) {
    if (y > 270) {
      y = startNewPage(doc, protocol);
    }
    doc.setFont("Inter", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...FOREST);
    doc.text("Akciópontok", MARGIN, y);
    y += 6;
    doc.setFont("Inter", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    for (const item of protocol.action_items) {
      if (!item.text.trim()) continue;
      const suffix = item.task_ref?.trim() ? `  (${item.task_ref.trim()})` : "";
      const wrapped = doc.splitTextToSize(`☐  ${item.text.trim()}${suffix}`, CONTENT_WIDTH - 2) as string[];
      for (const w of wrapped) {
        if (y > 280) {
          y = startNewPage(doc, protocol);
        }
        doc.text(w, MARGIN, y);
        y += 5.5;
      }
    }
    y += 4;
  }

  y = addSection(doc, protocol, y, "Következő heti fókusz", protocol.next_focus);

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("Inter", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Zusammen Dashboard — belső jegyzőkönyv", MARGIN, FOOTER_Y);
    doc.text(`${p} / ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: "right" });
  }

  return doc;
}

export async function downloadProtocolPdf(protocol: Protocol): Promise<void> {
  const doc = await buildProtocolPdf(protocol);
  doc.save(`jegyzokonyv-${protocol.entry_date}.pdf`);
}
