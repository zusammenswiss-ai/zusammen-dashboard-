// GYIK → PDF export — ugyanaz a márka-font-beágyazás, mint a
// Jegyzőkönyv exportnál (lásd lib/pdf-fonts.ts), hogy a magyar/német
// ékezetek helyesen jelenjenek meg nyelvtől függetlenül.
import { jsPDF } from "jspdf";
import type { SupportFaq, SupportFaqLanguage } from "@/lib/supabase/types";
import { SUPPORT_FAQ_LANGUAGE_HU, SUPPORT_FAQ_LANGUAGES } from "@/lib/labels";
import { registerBrandFonts } from "@/lib/pdf-fonts";
import { formatDate } from "@/lib/format";

const FOREST = [35, 51, 40] as const;
const BRONZE = [176, 138, 82] as const;
const MUTED = [110, 110, 105] as const;

const PAGE_WIDTH = 210;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 290;

export type FaqPdfScope = SupportFaqLanguage | "all";

function byQuestionAsc(a: SupportFaq, b: SupportFaq) {
  return a.question.localeCompare(b.question);
}

function scopeTitle(scope: FaqPdfScope): string {
  return scope === "all" ? "Minden nyelv" : SUPPORT_FAQ_LANGUAGE_HU[scope];
}

function addContinuationHeader(doc: jsPDF, scope: FaqPdfScope): number {
  doc.setFont("Inter", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Zusammen — GYIK · ${scopeTitle(scope)}`, MARGIN, 12);
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 15, PAGE_WIDTH - MARGIN, 15);
  return 24;
}

function startNewPage(doc: jsPDF, scope: FaqPdfScope): number {
  doc.addPage();
  return addContinuationHeader(doc, scope);
}

/** Egy nyelv kérdés-válasz listája — opcionális alcím (csak "all" scope
 * esetén, amikor több nyelv is egy PDF-be kerül egymás után). */
function addFaqGroup(doc: jsPDF, scope: FaqPdfScope, y: number, groupLabel: string | null, faqs: SupportFaq[]): number {
  if (faqs.length === 0) return y;

  if (groupLabel) {
    if (y > 270) y = startNewPage(doc, scope);
    doc.setFont("Fraunces", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...FOREST);
    doc.text(groupLabel, MARGIN, y);
    y += 8;
  }

  for (const faq of [...faqs].sort(byQuestionAsc)) {
    const questionLines = doc.setFont("Inter", "bold").setFontSize(10.5).splitTextToSize(faq.question, CONTENT_WIDTH) as string[];
    const answerLines = doc.setFont("Inter", "normal").setFontSize(10).splitTextToSize(faq.answer, CONTENT_WIDTH) as string[];
    const blockHeight = questionLines.length * 5.5 + answerLines.length * 5 + 8;
    if (y + blockHeight > 280 && y > 40) y = startNewPage(doc, scope);

    doc.setFont("Inter", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...FOREST);
    for (const line of questionLines) {
      if (y > 280) y = startNewPage(doc, scope);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 1;
    doc.setFont("Inter", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    for (const line of answerLines) {
      if (y > 280) y = startNewPage(doc, scope);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 3;
    doc.setDrawColor(...BRONZE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 7;
  }

  return y;
}

export async function buildFaqPdf(faqs: SupportFaq[], scope: FaqPdfScope): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerBrandFonts(doc);

  doc.setFillColor(...FOREST);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");
  doc.setFont("Fraunces", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Zusammen — GYIK", MARGIN, 17);
  doc.setFont("Inter", "normal");
  doc.setFontSize(10);
  doc.setTextColor(230, 230, 230);
  doc.text(`${scopeTitle(scope)} · ${formatDate(new Date().toISOString())}`, MARGIN, 23.5);

  let y = 38;

  if (scope === "all") {
    for (const lang of SUPPORT_FAQ_LANGUAGES) {
      const group = faqs.filter((f) => f.language === lang);
      y = addFaqGroup(doc, scope, y, SUPPORT_FAQ_LANGUAGE_HU[lang], group);
    }
  } else {
    y = addFaqGroup(doc, scope, y, null, faqs);
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("Inter", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Zusammen Dashboard — Ügyfélszolgálat GYIK", MARGIN, FOOTER_Y);
    doc.text(`${p} / ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: "right" });
  }

  return doc;
}

export async function downloadFaqPdf(faqs: SupportFaq[], scope: FaqPdfScope): Promise<void> {
  const doc = await buildFaqPdf(faqs, scope);
  const suffix = scope === "all" ? "osszes" : scope;
  doc.save(`gyik-${suffix}.pdf`);
}
