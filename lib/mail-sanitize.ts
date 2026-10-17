// Postafiók — bejövő HTML-levelek tisztítása tárolás előtt (XSS-védelem:
// script/iframe/object/embed/form és on*-eseménykezelők kiszedve,
// javascript: URL-ek blokkolva). A "külső képek letiltva" követelmény
// SZÁNDÉKOSAN NEM itt, hanem megjelenítéskor (a Postaláda nézet iframe
// sandbox-ában/CSP-jével, Phase 5) érvényesül — a <img src> attribútumok
// itt megmaradnak, hogy a tárolt tartalom ne veszítsen adatot, és a
// "Képek betöltése" gomb a felhasználó döntésén múljon, ne a tárolás
// pillanatában véglegesen eldöntött adatvesztésen.
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "style",
  "span",
  "div",
  "font",
  "center",
  "u",
  "s",
  "hr",
];

export function sanitizeInboundHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["style", "class", "align", "valign", "width", "height", "colspan", "rowspan", "cellpadding", "cellspacing", "border"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      font: ["color", "face", "size"],
    },
    allowedSchemes: ["http", "https", "mailto", "cid"],
    // A "cid:" séma a beágyazott (inline) képekhez kell — mailparser
    // simpleParser alapértelmezetten már data: URI-re cseréli ezeket
    // feldolgozáskor, de a tartalékot itt is megengedjük.
    allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
    disallowedTagsMode: "discard",
    allowVulnerableTags: true,
  });
}
