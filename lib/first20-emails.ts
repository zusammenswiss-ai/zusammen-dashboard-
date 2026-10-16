// First 20 — Print & Play e-mail sablonok (HU/DE/EN), a founder által
// küldött "Zusammen-First20-Emailek-HU-DE-EN.md" szövege alapján, szóról
// szóra átvéve. EZ AZ EGYETLEN HELY, ahol ez a szöveg él — a kézi küldés
// (app/api/marketing/first20/send) és a napi cron
// (app/api/cron/first20-emails) is ugyanezt a renderFirst20Email
// függvényt hívja, hogy az előnézet, a kézi küldés és az automata küldés
// garantáltan ugyanazt a tartalmat adja.
//
// Nincs szerver-only kód/titok ebben a fájlban (nincs env-olvasás, nincs
// adatbázis-hívás) — ezért biztonsággal importálható egy "use client"
// komponensből is (az élő előnézethez), NEM csak a szerveroldali
// send-route-ból.
import type { First20EmailType, First20Language } from "@/lib/supabase/types";

export const FIRST20_FOUNDERS_PRICE = "CHF 24";

const BRAND = {
  forest: "#294238",
  cream: "#f1ece3",
  gold: "#9a6a39",
};

type Para = { text: string } | { cta: string };

type EmailContent = {
  subject: string;
  preview: string;
  greeting: string;
  paragraphs: Para[];
  signatureLine1: string; // "Von Herzen," / "Hi" greeting already covers "Hallo"/"Szia"/"Hi" — this is just the sign-off opener
};

const FOOTER_LABEL: Record<First20Language, { privacy: string; unsubscribe: string }> = {
  hu: { privacy: "Adatvédelem", unsubscribe: "Leiratkozás" },
  de: { privacy: "Datenschutz", unsubscribe: "Abmelden" },
  en: { privacy: "Privacy", unsubscribe: "Unsubscribe" },
};

// {{language}} — a rendelt pakli nyelvének megjelenített neve, a levél
// SAJÁT nyelvén (nem feltétlenül ugyanaz, mint order_language maga).
export const FIRST20_LANGUAGE_NAME: Record<First20Language, Record<First20Language, string>> = {
  hu: { hu: "magyar", de: "német", en: "angol" },
  de: { hu: "Ungarisch", de: "Deutsch", en: "Englisch" },
  en: { hu: "Hungarian", de: "German", en: "English" },
};

const CONTENT: Record<Exclude<First20EmailType, "custom">, Record<First20Language, EmailContent>> = {
  kit: {
    hu: {
      subject: "Itt az Első este készletetek",
      preview: "Egy óra, két ember, kilenc kártya.",
      greeting: "Szia {{first_name}},",
      paragraphs: [
        { text: "köszönjük, hogy jelentkeztetek! Itt az Első este készlet: egy nyomtatható útmutató, kilenc kártya és egy telefon-parkoló cédula." },
        { text: "Nincs más dolgotok, mint kinyomtatni, kiválasztani egy estét, letenni a telefont, és húzni egy kártyát." },
        { cta: "A KÉSZLET LETÖLTÉSE" },
        { text: "Egy tipp: vastagabb papírra (200 g/m² vagy több) nyomtatva sokkal szebb lesz. A nyomtatás után telefonra nincs is szükségetek." },
        { text: "Pár napon belül újra jelentkezünk. Addig semmi sietség: csak az számít, hogy ott legyetek." },
      ],
      signatureLine1: "Von Herzen,",
    },
    de: {
      subject: "Euer Erste-Abend-Set ist da",
      preview: "Eine Stunde, zwei Menschen, neun Karten.",
      greeting: "Hallo {{first_name}},",
      paragraphs: [
        { text: "danke für eure Anmeldung! Hier ist euer Erste-Abend-Set: eine druckbare Anleitung, neun Karten und ein Handy-Parkplatz." },
        { text: "Ihr müsst nur drucken, einen Abend aussuchen, die Handys weglegen und eine Karte ziehen." },
        { cta: "SET HERUNTERLADEN" },
        { text: "Ein Tipp: Auf dickerem Papier (200 g/m² oder mehr) wird es viel schöner. Nach dem Drucken braucht ihr das Handy nicht mehr." },
        { text: "In ein paar Tagen melden wir uns wieder. Bis dahin gilt: keine Eile. Wichtig ist nur, dass ihr da seid." },
      ],
      signatureLine1: "Von Herzen,",
    },
    en: {
      subject: "Your First Evening Kit is here",
      preview: "One hour, two people, nine cards.",
      greeting: "Hi {{first_name}},",
      paragraphs: [
        { text: "thank you for signing up! Here is your First Evening Kit: a printable guide, nine cards and a phone parking slip." },
        { text: "All you need to do is print it, pick an evening, put your phones away and draw a card." },
        { cta: "DOWNLOAD THE KIT" },
        { text: "A tip: it looks much nicer on thicker paper (200 gsm or more). After printing, you won't need your phone at all." },
        { text: "We'll be in touch again in a few days. Until then, there's no rush: all that matters is that you show up." },
      ],
      signatureLine1: "Von Herzen,",
    },
  },
  reminder: {
    hu: {
      subject: "Megvan már az estétek?",
      preview: "Egy óra elég.",
      greeting: "Szia {{first_name}},",
      paragraphs: [
        { text: "még nem késő: válasszatok egy estét ezen a héten. Nem kell hozzá semmi különleges, csak egy asztal, egy óra és két ember." },
        { text: "Ha nincs kéznél a készlet: {{cta}}" },
        { text: "Ha elakadtatok a nyomtatással, válaszoljatok erre a levélre, és segítünk." },
      ],
      signatureLine1: "Von Herzen,",
    },
    de: {
      subject: "Habt ihr euren Abend schon gefunden?",
      preview: "Eine Stunde reicht.",
      greeting: "Hallo {{first_name}},",
      paragraphs: [
        { text: "es ist noch nicht zu spät: Sucht euch diese Woche einen Abend aus. Dafür braucht es nichts Besonderes, nur einen Tisch, eine Stunde und zwei Menschen." },
        { text: "Falls ihr das Set nicht mehr zur Hand habt: {{cta}}" },
        { text: "Falls es beim Drucken hakt, antwortet einfach auf diese Mail, wir helfen euch." },
      ],
      signatureLine1: "Von Herzen,",
    },
    en: {
      subject: "Have you found your evening yet?",
      preview: "One hour is enough.",
      greeting: "Hi {{first_name}},",
      paragraphs: [
        { text: "it's not too late: pick an evening this week. It doesn't need to be anything special, just a table, an hour and two people." },
        { text: "If you can't find the kit: {{cta}}" },
        { text: "If printing got in the way, just reply to this email and we'll help." },
      ],
      signatureLine1: "Von Herzen,",
    },
  },
  feedback: {
    hu: {
      subject: "Milyen volt az estétek?",
      preview: "Három rövid kérdés, két perc.",
      greeting: "Szia {{first_name}},",
      paragraphs: [
        { text: "remélem, megvolt az estétek. Ha még nem, semmi baj: a visszajelzést később is megadhatjátok." },
        { text: "Három rövid kérdés vár rátok, ez kb. két perc: {{cta}}" },
        { text: "A végén megmutatjuk, hogyan kaphatjátok meg a teljes, 58 lapos paklit alapítói áron." },
        { text: "Köszönjük, hogy segítetek jobbá tenni." },
      ],
      signatureLine1: "Von Herzen,",
    },
    de: {
      subject: "Wie war euer Abend?",
      preview: "Drei kurze Fragen, zwei Minuten.",
      greeting: "Hallo {{first_name}},",
      paragraphs: [
        { text: "wir hoffen, ihr hattet euren Abend. Falls noch nicht, kein Problem: Euer Feedback könnt ihr auch später geben." },
        { text: "Drei kurze Fragen warten auf euch, das dauert etwa zwei Minuten: {{cta}}" },
        { text: "Am Ende zeigen wir euch, wie ihr das ganze Spiel mit 58 Karten zum Gründerpreis bekommt." },
        { text: "Danke, dass ihr uns helft, es besser zu machen." },
      ],
      signatureLine1: "Von Herzen,",
    },
    en: {
      subject: "How was your evening?",
      preview: "Three short questions, two minutes.",
      greeting: "Hi {{first_name}},",
      paragraphs: [
        { text: "we hope you had your evening. If not yet, no problem: you can give your feedback later." },
        { text: "Three short questions are waiting for you, about two minutes: {{cta}}" },
        { text: "At the end we'll show you how to get the full 58-card deck at the founders' price." },
        { text: "Thank you for helping us make it better." },
      ],
      signatureLine1: "Von Herzen,",
    },
  },
  order_confirmation: {
    hu: {
      subject: "Megkaptuk a rendelésetek",
      preview: "A számlát a feladáskor küldjük.",
      greeting: "Szia {{first_name}},",
      paragraphs: [
        { text: "köszönjük! Megkaptuk a rendelésetek: Zusammen Pear Edition, {{language}} nyelven, alapítói áron ({{price}})." },
        { text: "Ez nem kötelez előre fizetésre. A számlát (QR-számlát) akkor küldjük, amikor a pakli útnak indul. A pontos szállítási időpontról e-mailben értesítünk, amint biztos." },
        { text: "Ha kérdésetek van, válaszoljatok erre a levélre." },
      ],
      signatureLine1: "Von Herzen,",
    },
    de: {
      subject: "Wir haben eure Bestellung erhalten",
      preview: "Die Rechnung kommt erst beim Versand.",
      greeting: "Hallo {{first_name}},",
      paragraphs: [
        { text: "danke! Wir haben eure Bestellung erhalten: Zusammen Pear Edition auf {{language}}, zum Gründerpreis ({{price}})." },
        { text: "Das verpflichtet euch nicht zu einer Vorauszahlung. Die Rechnung (QR-Rechnung) schicken wir, sobald das Spiel unterwegs ist. Den genauen Liefertermin teilen wir euch per E-Mail mit, sobald er feststeht." },
        { text: "Bei Fragen antwortet einfach auf diese Mail." },
      ],
      signatureLine1: "Von Herzen,",
    },
    en: {
      subject: "We've received your order",
      preview: "The invoice only comes when it ships.",
      greeting: "Hi {{first_name}},",
      paragraphs: [
        { text: "thank you! We've received your order: Zusammen Pear Edition in {{language}}, at the founders' price ({{price}})." },
        { text: "This doesn't commit you to paying in advance. We'll send the invoice (a Swiss QR-bill) when the deck ships. We'll tell you the exact delivery date by email as soon as it's confirmed." },
        { text: "If you have any questions, just reply to this email." },
      ],
      signatureLine1: "Von Herzen,",
    },
  },
};

export type First20EmailVars = {
  firstName: string;
  kitUrl: string;
  feedbackUrl: string;
  orderLanguage: First20Language | null;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function substitute(raw: string, lang: First20Language, vars: First20EmailVars): string {
  const languageName = vars.orderLanguage ? FIRST20_LANGUAGE_NAME[lang][vars.orderLanguage] : "";
  return raw
    .replace(/\{\{\s*first_name\s*\}\}/g, vars.firstName)
    .replace(/\{\{\s*language\s*\}\}/g, languageName)
    .replace(/\{\{\s*price\s*\}\}/g, FIRST20_FOUNDERS_PRICE);
}

function ctaUrlFor(type: First20EmailType, vars: First20EmailVars): string {
  if (type === "feedback") return vars.feedbackUrl;
  return vars.kitUrl; // kit + reminder both link back to the kit PDF
}

const INLINE_CTA_LABEL: Record<"feedback" | "reminder", Record<First20Language, string>> = {
  feedback: { hu: "VISSZAJELZÉS ADÁSA", de: "FEEDBACK GEBEN", en: "GIVE FEEDBACK" },
  reminder: { hu: "ÚJRA LETÖLTÉS", de: "NOCHMALS HERUNTERLADEN", en: "DOWNLOAD AGAIN" },
};

function renderParagraph(para: Para, type: First20EmailType, lang: First20Language, vars: First20EmailVars): string {
  if ("cta" in para) {
    const label = escapeHtml(para.cta);
    return `<p style="text-align:center;margin:28px 0;"><a href="${ctaUrlFor(type, vars)}" style="display:inline-block;background:${BRAND.gold};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">${label}</a></p>`;
  }
  const substituted = substitute(para.text, lang, vars);
  // {{cta}} sits inline inside a sentence (reminder/feedback) — escape the
  // surrounding plain-text parts separately, then splice in a real <a>
  // tag, rather than escaping the whole string after building it (which
  // would mangle the tag's own quotes/brackets).
  const parts = substituted.split(/\{\{\s*cta\s*\}\}/);
  let html = escapeHtml(parts[0]);
  if (parts.length > 1 && (type === "feedback" || type === "reminder")) {
    const label = INLINE_CTA_LABEL[type][lang];
    html += `<a href="${ctaUrlFor(type, vars)}" style="color:${BRAND.gold};font-weight:600;">${escapeHtml(label)}</a>`;
    html += escapeHtml(parts.slice(1).join(""));
  }
  return `<p style="margin:0 0 16px;line-height:1.6;">${html}</p>`;
}

/** {{firstName}}/{{kitUrl}}/{{feedbackUrl}}/{{language}}/{{price}} filled
 * in, wrapped in the shared brand shell (zöld/krém/arany, "Von Herzen,
 * Zusammen" aláírás, Datenschutz/Abmelden lábléc). `privacyUrl` and
 * `unsubscribeTag` are injected by the caller (server-side knows the
 * live Adatvédelem link and the Brevo {unsubscribe} merge tag — this
 * module itself has no server/DB access). For type "custom", pass
 * `customSubject`/`customBodyText` instead of relying on CONTENT. */
export function renderFirst20Email(
  type: First20EmailType,
  lang: First20Language,
  vars: First20EmailVars,
  opts: { privacyUrl: string; unsubscribeHref: string; customSubject?: string; customBodyText?: string }
): { subject: string; html: string } {
  if (type === "custom") {
    const subject = opts.customSubject?.trim() || "Zusammen";
    const bodyHtml = (opts.customBodyText ?? "")
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");
    return { subject, html: wrapShell(bodyHtml, lang, opts.privacyUrl, opts.unsubscribeHref) };
  }

  const content = CONTENT[type][lang];
  const subject = substitute(content.subject, lang, vars);
  const greeting = substitute(content.greeting, lang, vars);
  const body =
    `<p style="font-size:1.05rem;margin:0 0 20px;">${escapeHtml(greeting)}</p>` +
    content.paragraphs.map((p) => renderParagraph(p, type, lang, vars)).join("");
  const signatureHtml = `<p style="margin:28px 0 0;">${escapeHtml(content.signatureLine1)}<br/>Zusammen</p>`;
  return { subject, html: wrapShell(body + signatureHtml, lang, opts.privacyUrl, opts.unsubscribeHref) };
}

function wrapShell(bodyHtml: string, lang: First20Language, privacyUrl: string, unsubscribeHref: string): string {
  const footer = FOOTER_LABEL[lang];
  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${BRAND.forest};">
  <div style="max-width:520px;margin:0 auto;padding:40px 16px;">
    <div style="background:#ffffff;border-radius:14px;padding:36px 32px;">
      <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:1.3rem;font-weight:600;color:${BRAND.forest};">Zusammen</p>
      ${bodyHtml}
    </div>
    <p style="margin:24px 0 0;text-align:center;font-size:12px;color:#8a8275;">
      <a href="${privacyUrl}" style="color:#8a8275;text-decoration:underline;">${footer.privacy}</a>
      &nbsp;·&nbsp;
      <a href="${unsubscribeHref}" style="color:#8a8275;text-decoration:underline;">${footer.unsubscribe}</a>
    </p>
  </div>
</body>
</html>`;
}

/** Preview-only szöveges tárgy-mező segédlet (a Jelentkezők fülön a
 * sablon-választó dropdown ehhez a nyelvhez tartozó tárgyat is mutatja
 * küldés előtt). */
export function first20EmailPreviewSubject(type: Exclude<First20EmailType, "custom">, lang: First20Language): string {
  return CONTENT[type][lang].subject;
}
