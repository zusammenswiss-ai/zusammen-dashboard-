// Megosztott jsPDF márka-font betöltő — kiemelve lib/protocol-pdf.ts-ből,
// hogy más PDF-exportok (pl. lib/faq-pdf.ts) is ugyanazt a cache-elt
// betöltést/regisztrációt használják, ne írják le újra.
//
// jsPDF beépített fontjai (helvetica/times/courier) a WinAnsi
// kódolást használják, amiben NINCS "ő"/"ű" (U+0151/U+0171) — ezek a
// karakterek hibásan vagy egyáltalán nem jelennek meg. Ezért a dashboard
// saját, már amúgy is használt brand-fontjait (Inter, Fraunces — lásd
// public/fonts/pdf/) ágyazzuk be minden PDF-be, mindkettő teljes magyar
// ékezet-lefedettséggel (és a német umlautokat is lefedi).
import type { jsPDF } from "jspdf";

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
 * minden registerBrandFonts hívás ugyanazt a base64-et regisztrálja az
 * adott jsPDF példányra — az addFileToVFS/addFont példányonkénti, a
 * letöltés nem, úgyhogy nem kell újra hálózatra menni minden exportnál. */
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

export async function registerBrandFonts(doc: jsPDF): Promise<void> {
  const data = await loadFontData();
  FONT_FILES.forEach((f, i) => {
    doc.addFileToVFS(f.file, data[i]);
    doc.addFont(f.file, f.name, f.style);
  });
}
