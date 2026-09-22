// Kliens-oldali PDF-oldal-kinyerés — egy feltöltött production mockup
// (pl. a 116 oldalas Pear Edition front+back fájl) minden oldalát
// PNG-vé rendereli a böngészőben, szerver round-trip nélkül. Lásd
// PdfPageAssignmentModal, ahol ezek az oldalak kártyákhoz rendelhetők.
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

export interface ExtractedPdfPage {
  pageNumber: number;
  dataUrl: string;
}

/** A PDF minden oldalát kirendereli egy-egy PNG data URL-lé. `scale=1.5`
 * elég felbontást ad egy kártya-oldal átnézéséhez anélkül, hogy sok
 * tucat oldalnál a böngésző memóriáját túlterhelné. */
export async function extractPdfPages(data: ArrayBuffer, scale = 1.5): Promise<ExtractedPdfPage[]> {
  if (!pdfjsLibPromise) pdfjsLibPromise = loadPdfjs();
  const pdfjsLib = await pdfjsLibPromise;
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: ExtractedPdfPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push({ pageNumber, dataUrl: canvas.toDataURL("image/png") });
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
