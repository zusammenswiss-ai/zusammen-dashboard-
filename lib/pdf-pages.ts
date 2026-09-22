// Kliens-oldali PDF-oldal-kinyerés — egy feltöltött production mockup
// (pl. a 116 oldalas Pear Edition front+back fájl) minden oldalát
// PNG-vé rendereli a böngészőben, szerver round-trip nélkül. Lásd
// PdfPageAssignmentModal / PdfBulkImportModal / LoadFromFilesModal, ahol
// ezek az oldalak kártyákhoz rendelhetők, ill. kártyaként importálhatók.
// Dinamikus import — a pdfjs-dist csak akkor töltődik be, amikor
// ténylegesen szükség van rá, így nem terheli a build SSR/prerender
// lépését (Node.js-ben nem a böngésző-build a célja) sem a kezdeti
// bundle méretét azoknál az oldalaknál, amik nem használják.
let pdfjsLibPromise: ReturnType<typeof loadPdfjs> | null = null;
async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  // A webpack/Turbopack által is értett `new URL(..., import.meta.url)`
  // asset-mintát használja, hogy a worker fájl a build része legyen —
  // nem szerver route, tisztán statikus asset.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjsLib;
}

export type PdfDocument = Awaited<ReturnType<typeof loadPdfDocument>>;

/** A PDF egyszeri betöltése/feldolgozása — a hívó megtartja a
 * visszaadott dokumentumot, hogy utána tetszőleges oldalt tetszőleges
 * felbontásban újra ki tudjon rendereltetni (lásd renderPdfPage), a
 * teljes fájl újra-letöltése/-parse-olása nélkül. */
export async function loadPdfDocument(data: ArrayBuffer) {
  if (!pdfjsLibPromise) pdfjsLibPromise = loadPdfjs();
  const pdfjsLib = await pdfjsLibPromise;
  return pdfjsLib.getDocument({ data }).promise;
}

/** Egyetlen oldal kirenderelése a kért felbontásban. `scale=1` a PDF
 * saját (72 DPI) pontméretének felel meg — a nyomdai minőségű mentéshez
 * HIGH_RES_SCALE-t kell használni, a gyors böngészéshez/bélyegképekhez
 * ennél jóval kisebbet. */
export async function renderPdfPage(pdf: PdfDocument, pageNumber: number, scale: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A böngésző nem támogatja a canvas renderelést.");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

/** ~288 DPI (4× a PDF 72 DPI pontméretéhez képest) — elég éles ahhoz,
 * hogy a végleges nyomtatott kártyát ellenőrizni lehessen rajta (finom
 * szövegek, szín-árnyalatok), de még egyetlen oldalra korlátozva (lásd
 * renderPdfPage) nem terheli túl a böngésző memóriáját, ha sok tucat
 * oldalas a PDF. */
export const HIGH_RES_SCALE = 4;
/** Gyors, alacsony felbontású előnézet — lapozáshoz/kiválasztáshoz, ahol
 * akár száz oldalt is egyszerre ki kell rendereltetni. */
export const PREVIEW_SCALE = 1;

export interface ExtractedPdfPage {
  pageNumber: number;
  dataUrl: string;
}

/** A PDF minden oldalát kirendereli egy-egy PNG data URL-lé — a
 * lapozható előnézethez/kiválasztáshoz, nem a végleges mentéshez (lásd
 * HIGH_RES_SCALE + renderPdfPage a ténylegesen elmentett oldalhoz). */
export async function extractPdfPages(data: ArrayBuffer, scale = PREVIEW_SCALE): Promise<ExtractedPdfPage[]> {
  const pdf = await loadPdfDocument(data);
  const pages: ExtractedPdfPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    pages.push({ pageNumber, dataUrl: await renderPdfPage(pdf, pageNumber, scale) });
  }
  return pages;
}

/** data URL → Blob, a kinyert oldal Storage-ba feltöltéséhez (a Supabase
 * JS kliens File/Blob-ot vár, nem data URL stringet). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
