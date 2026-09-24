// Kliens-oldali PDF-oldal-kinyerés — egy feltöltött production mockup
// (pl. a 116 oldalas Pear Edition front+back fájl) minden oldalát
// PNG-vé rendereli a böngészőben, szerver round-trip nélkül. Lásd
// PdfPageAssignmentModal / PdfBulkImportModal / LoadFromFilesModal, ahol
// ezek az oldalak kártyákhoz rendelhetők, ill. kártyaként importálhatók.
// Dinamikus import — a pdfjs-dist csak akkor töltődik be, amikor
// ténylegesen szükség van rá, így nem terheli a build SSR/prerender
// lépését (Node.js-ben nem a böngésző-build a célja) sem a kezdeti
// bundle méretét azoknál az oldalaknál, amik nem használják.
// A pdfjs-dist 6.x minden PDF betöltésekor (pl. a dokumentum
// "fingerprint"-jének számításához) a Uint8Array.prototype.toHex/toBase64
// és a Uint8Array.fromHex/fromBase64 natív JS motor-szintű metódusokra
// támaszkodik — ezek viszonylag friss (2024 végi) böngésző-funkciók, egy
// ennél régebbi Chrome-ban/Safariban még nincsenek meg, és nélkülük a
// PDF-betöltés rögtön "toHex is not a function" hibával elszáll. A
// polyfill-t mind a fő szálon, mind a pdf.js SAJÁT Web Workerében külön
// be kell tölteni — a worker külön globális scope-ban fut, a fő szálon
// tett prototípus-patch oda nem ér el.
function polyfillUint8ArrayHexBase64(target: typeof Uint8Array) {
  const proto = target.prototype as Uint8Array & { toHex?: () => string; toBase64?: () => string };
  if (typeof proto.toHex !== "function") {
    proto.toHex = function (this: Uint8Array) {
      let out = "";
      for (let i = 0; i < this.length; i++) out += this[i].toString(16).padStart(2, "0");
      return out;
    };
  }
  const ctor = target as typeof Uint8Array & {
    fromHex?: (hex: string) => Uint8Array;
    fromBase64?: (base64: string) => Uint8Array;
  };
  if (typeof ctor.fromHex !== "function") {
    ctor.fromHex = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return bytes;
    };
  }
  if (typeof proto.toBase64 !== "function") {
    proto.toBase64 = function (this: Uint8Array) {
      let binary = "";
      for (let i = 0; i < this.length; i++) binary += String.fromCharCode(this[i]);
      return btoa(binary);
    };
  }
  if (typeof ctor.fromBase64 !== "function") {
    ctor.fromBase64 = (base64: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    };
  }
}

// Ugyanennek a polyfillnek a forráskódja stringként — a worker saját,
// külön global scope-jában kell lefusson, MIELŐTT a pdf.js worker kódja
// betöltődne. Ezt egy Blob URL-lé csomagolt kis wrapper modullal érjük
// el: a worker ténylegesen ezt tölti be, ami előbb lefuttatja a
// polyfillt, utána importálja a valódi pdfjs-dist worker fájlt.
const WORKER_POLYFILL_SOURCE = `
function polyfillUint8ArrayHexBase64(target) {
  const proto = target.prototype;
  if (typeof proto.toHex !== "function") {
    proto.toHex = function () {
      let out = "";
      for (let i = 0; i < this.length; i++) out += this[i].toString(16).padStart(2, "0");
      return out;
    };
  }
  if (typeof target.fromHex !== "function") {
    target.fromHex = function (hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return bytes;
    };
  }
  if (typeof proto.toBase64 !== "function") {
    proto.toBase64 = function () {
      let binary = "";
      for (let i = 0; i < this.length; i++) binary += String.fromCharCode(this[i]);
      return btoa(binary);
    };
  }
  if (typeof target.fromBase64 !== "function") {
    target.fromBase64 = function (base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    };
  }
}
polyfillUint8ArrayHexBase64(Uint8Array);
`;

let pdfjsLibPromise: ReturnType<typeof loadPdfjs> | null = null;
async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  polyfillUint8ArrayHexBase64(Uint8Array);
  // A webpack/Turbopack által is értett `new URL(..., import.meta.url)`
  // asset-mintát használja, hogy a worker fájl a build része legyen —
  // nem szerver route, tisztán statikus asset. A tényleges workerSrc
  // viszont egy Blob URL-be csomagolt wrapper (lásd fent), ami előbb a
  // polyfillt tölti be, utána ezt az eredeti fájlt.
  const realWorkerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const wrapperBlob = new Blob([`${WORKER_POLYFILL_SOURCE}\nimport ${JSON.stringify(realWorkerUrl)};\n`], {
    type: "text/javascript",
  });
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(wrapperBlob);
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
