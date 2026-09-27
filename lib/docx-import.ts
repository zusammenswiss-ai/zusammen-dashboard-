// Kliens-oldali .docx → egyszerű szöveg kinyerés a Jegyzőkönyvek modul
// "Word beillesztése" gombjához — nem teljes docx-renderelés (formázás,
// képek, táblázatok elvesznek), csak a bekezdésekre/sortörésekre bontott
// nyers szöveg, hogy egy előre Wordben megírt jegyzőkönyv-vázlat
// bemásolható legyen a megfelelő mezőbe kézi átgépelés nélkül. Egy .docx
// fájl valójában egy zip, aminek a word/document.xml-je tartalmazza a
// szöveget XML-be csomagolva — a JSZip csomag már amúgy is függősége a
// projektnek (lásd Kártyatervező export), nincs szükség új csomagra.
import JSZip from "jszip";

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function extractDocxText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Nem sikerült beolvasni a Word fájlt — érvénytelen vagy sérült .docx.");
  }

  const withBreaks = documentXml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n");
  const plain = decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ""));

  return plain
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
