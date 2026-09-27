// Jegyzőkönyv → PDF export, márka-színekkel (lásd app/globals.css
// --forest/--bronze/--ivory tokenjeit — ugyanazok a hex kódok, csak
// jsPDF nem tud CSS-változót olvasni). Kliens-oldalon fut, ugyanaz a
// jsPDF csomag, amit a Kártyatervező ExportPanel-je is használ.
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
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function isSnapshot(value: Record<string, unknown>): value is WeeklyStatsSnapshot {
  return typeof value.computedAt === "string";
}

function addSection(doc: jsPDF, y: number, title: string, body: string | null): number {
  if (!body || !body.trim()) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...FOREST);
  doc.text(title, MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const lines = body.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const bulleted = `•  ${line.trim()}`;
    const wrapped = doc.splitTextToSize(bulleted, CONTENT_WIDTH - 2) as string[];
    for (const w of wrapped) {
      if (y > 280) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(w, MARGIN, y);
      y += 5.5;
    }
  }
  return y + 4;
}

export function buildProtocolPdf(protocol: Protocol): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Fejléc — márka-sáv
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Zusammen — Jegyzőkönyv", MARGIN, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(230, 230, 230);
  doc.text(formatDate(protocol.entry_date), MARGIN, 23.5);

  let y = 38;

  // Heti statisztika pillanatkép
  const snapshot = protocol.stats_snapshot;
  if (snapshot && isSnapshot(snapshot)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...FOREST);
    doc.text("Heti statisztika pillanatkép", MARGIN, y);
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...MUTED);
    doc.text(`Rögzítve: ${formatDate(snapshot.computedAt)}`, MARGIN, y + 4);
    y += 9;

    doc.setDrawColor(...BRONZE);
    doc.setLineWidth(0.3);
    for (const { key, label } of STATS_ROW_LABELS) {
      const raw = snapshot[key];
      const isMoney = key === "revenueTotal" || key === "expenseTotal";
      const value = isMoney ? formatMoney(raw, snapshot.currency) : String(raw);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(label, MARGIN, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WALNUT);
      doc.text(value, PAGE_WIDTH - MARGIN, y, { align: "right" });
      y += 6;
      doc.line(MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4);
    }
    y += 6;
  }

  y = addSection(doc, y, "Megbeszélt témák", protocol.topics);
  y = addSection(doc, y, "Döntések", protocol.decisions);
  y = addSection(doc, y, "Kockázatok / figyelmeztetések", protocol.risks);

  if (protocol.action_items.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...FOREST);
    doc.text("Akciópontok", MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    for (const item of protocol.action_items) {
      if (!item.text.trim()) continue;
      const suffix = item.task_ref?.trim() ? `  (${item.task_ref.trim()})` : "";
      const wrapped = doc.splitTextToSize(`☐  ${item.text.trim()}${suffix}`, CONTENT_WIDTH - 2) as string[];
      for (const w of wrapped) {
        if (y > 280) {
          doc.addPage();
          y = MARGIN;
        }
        doc.text(w, MARGIN, y);
        y += 5.5;
      }
    }
    y += 4;
  }

  y = addSection(doc, y, "Következő heti fókusz", protocol.next_focus);

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Zusammen Dashboard — belső jegyzőkönyv", MARGIN, 290);
    doc.text(`${p} / ${pageCount}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
  }

  return doc;
}

export function downloadProtocolPdf(protocol: Protocol): void {
  const doc = buildProtocolPdf(protocol);
  doc.save(`jegyzokonyv-${protocol.entry_date}.pdf`);
}
