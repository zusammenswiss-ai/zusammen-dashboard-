// Translations for /first20 — the public "First 20" signup campaign
// page. Three real on-page languages (Hungarian, German, English), unlike
// /landing which only ever had German/English (see landing-i18n.ts) —
// the signup form's own "which language would you like the deck in?"
// field offers all three, so the page itself needs to speak all three.
import type { First20Language } from "./supabase/types";

export type First20Lang = First20Language;
export const FIRST20_LANGS: First20Lang[] = ["de", "hu", "en"];

export const HOW_HEARD_OPTIONS = ["instagram", "friend", "facebook_group", "other"] as const;
export type HowHeardOption = (typeof HOW_HEARD_OPTIONS)[number];

type T = {
  langLabel: string;
  nav: { eyebrow: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    microline: string;
  };
  steps: {
    title: string;
    items: { title: string; body: string }[];
  };
  cards: {
    title: string;
    suits: { icon: string; name: string; question: string }[];
    extra: string;
  };
  why: {
    title: string;
    body: string;
    youGetLabel: string;
    youGet: string;
    weAskLabel: string;
    weAsk: string;
  };
  signup: {
    title: string;
    counter: (taken: number) => string;
    counterFallback: string;
    firstName: string;
    firstNamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    partnerFirstName: string;
    partnerFirstNamePlaceholder: string;
    languageQuestion: string;
    languageOptions: Record<First20Lang, string>;
    howHeardQuestion: string;
    howHeardOptions: Record<HowHeardOption, string>;
    consentPrefix: string;
    consentLinkText: string;
    consentSuffix: string;
    submit: string;
    submitting: string;
    footnote: string;
    success: string;
    alreadyRegistered: string;
    errors: {
      firstName: string;
      email: string;
      consent: string;
      rateLimited: string;
      generic: string;
    };
  };
  faq: {
    title: string;
    items: { q: string; a: string }[];
  };
  footer: {
    tagline: string;
  };
  stickyCta: string;
};

export const first20T: Record<First20Lang, T> = {
  de: {
    langLabel: "DE",
    nav: { eyebrow: "ZUSAMMEN · FIRST 20" },
    hero: {
      eyebrow: "ZUSAMMEN · FIRST 20",
      title: "Wann habt ihr euch das letzte Mal wirklich zugehört?",
      subtitle:
        "Ein Kartenspiel für zwei Menschen. Ein Abend ohne Handy und ohne Lärm — nur ihr beide.",
      cta: "Set anfordern",
      microline: "20 Gründerplätze · das Erste-Abend-Set ist gratis · das ganze Spiel zum Gründerpreis: CHF 24",
    },
    steps: {
      title: "So funktioniert's",
      items: [
        {
          title: "Anmelden",
          body: "Ein paar Angaben, ohne Zahlung.",
        },
        {
          title: "Set erhalten",
          body: "Sofort per E-Mail: Anleitung, 9 Karten und ein Handy-Parkplatz als druckbares PDF.",
        },
        {
          title: "Einen Abend erleben",
          body: "Eine Stunde, ohne Handy.",
        },
        {
          title: "Erzähl uns, wie es war",
          body: "Danach kannst du das ganze Spiel mit 58 Karten zum Gründerpreis bestellen (CHF 24, Rechnung erst beim Versand).",
        },
      ],
    },
    cards: {
      title: "58 Karten. Ein Versprechen.",
      suits: [
        { icon: "heart", name: "Herz · Liebe", question: "„Was hat mich zuerst an dir fasziniert?“" },
        { icon: "cup", name: "Tasse · Alltag", question: "„Was ist unser liebstes gemeinsames Alltagsritual?“" },
        {
          icon: "mountain",
          name: "Berg · Träume & Wachstum",
          question: "„Welchen gemeinsamen Traum würdest du verwirklichen?“",
        },
        {
          icon: "lake",
          name: "See · Erinnerungen & Dankbarkeit",
          question: "„Welche gemeinsame Erinnerung bewahrst du am meisten?“",
        },
      ],
      extra:
        "Dazu fünf Wild Cards, die euch aus der Routine holen, und zum Schluss eine Gold Card: Ein Brief. Ein Jahr. Ein Versprechen.",
    },
    why: {
      title: "Warum nur 20 Paare?",
      body: "Weil wir gerade lernen. Gemeinsam mit den ersten zwanzig Paaren feilen wir das Kartenspiel zur Perfektion — ihr sagt uns, was funktioniert, was nicht, und welche Frage am tiefsten berührt hat.",
      youGetLabel: "Ihr bekommt:",
      youGet: "sofort das Erste-Abend-Set, und die ersten 20 Bestellungen erhalten das ganze Spiel zum Gründerpreis (CHF 24).",
      weAskLabel: "Wir bitten um:",
      weAsk: "einen Abend und 10 Minuten ehrliches Feedback. Ein Foto nur, wenn ihr das möchtet.",
    },
    signup: {
      title: "Sichert euch euren Platz.",
      counter: (taken) => `${taken} / 20 Plätze vergeben`,
      counterFallback: "20 Plätze",
      firstName: "Vorname",
      firstNamePlaceholder: "Dein Vorname",
      email: "E-Mail",
      emailPlaceholder: "du@beispiel.ch",
      partnerFirstName: "Vorname deiner Partnerin / deines Partners",
      partnerFirstNamePlaceholder: "optional",
      languageQuestion: "Welche Sprache soll das Kartenspiel haben?",
      languageOptions: { de: "Deutsch", hu: "Ungarisch", en: "Englisch" },
      howHeardQuestion: "Wie habt ihr von uns erfahren?",
      howHeardOptions: {
        instagram: "Instagram",
        friend: "Bekannte",
        facebook_group: "Facebook-Gruppe",
        other: "Sonstiges",
      },
      consentPrefix: "Ich stimme zu, dass Zusammen mich per E-Mail über das First-20-Programm informiert. Ich kann mich jederzeit abmelden. ",
      consentLinkText: "Datenschutzerklärung",
      consentSuffix: "",
      submit: "Set anfordern",
      submitting: "Wird gesendet…",
      footnote:
        "Die Anmeldung ist kostenlos und unverbindlich. Das ganze Spiel kannst du erst nach dem Abend bestellen, auch das ist unverbindlich: Die Rechnung kommt erst beim Versand.",
      success:
        "Danke! Wir haben dir das Erste-Abend-Set per E-Mail geschickt. Schau bitte auch im Spam-Ordner nach.",
      alreadyRegistered: "Diese E-Mail-Adresse ist schon angemeldet — wir haben euch nicht vergessen.",
      errors: {
        firstName: "Bitte gib deinen Vornamen ein.",
        email: "Bitte gib eine gültige E-Mail-Adresse ein.",
        consent: "Bitte bestätige die Einwilligung, um fortzufahren.",
        rateLimited: "Zu viele Versuche — bitte versuche es in einer Stunde erneut.",
        generic: "Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.",
      },
    },
    faq: {
      title: "Häufige Fragen",
      items: [
        {
          q: "Was kostet es?",
          a: "Das Erste-Abend-Set ist gratis. Das ganze Spiel mit 58 Karten gibt es für die ersten 20 Bestellungen zum Gründerpreis von CHF 24. Bestellen kannst du nach dem Abend, unverbindlich; die Rechnung schicken wir erst beim Versand.",
        },
        {
          q: "Wann bekommen wir es?",
          a: "Das Set kommt direkt nach der Anmeldung per E-Mail. Den genauen Liefertermin für das ganze Spiel können wir noch nicht nennen; wer bestellt, erfährt ihn als Erstes.",
        },
        {
          q: "Was passiert, wenn die 20 Plätze voll sind?",
          a: "Das Set bekommst du trotzdem. Ab der 21. Bestellung kommst du auf die Warteliste und erfährst als Erstes von der nächsten Runde.",
        },
        {
          q: "In welcher Sprache?",
          a: "Das Erste-Abend-Set gibt es auf Deutsch, Ungarisch und Englisch, bei der Anmeldung kannst du wählen. Die erste Runde des ganzen Spiels erscheint auf Deutsch; Ungarisch und Englisch folgen je nach Nachfrage.",
        },
        {
          q: "Was macht ihr mit meinen Daten?",
          a: "Wir schreiben nur über das Programm, geben nichts an Dritte weiter. Du kannst dich jederzeit abmelden.",
        },
        {
          q: "Wer seid ihr?",
          a: "Ich bin Barbara — geboren in Ungarn, lebe heute in der Schweiz und baue zusammen mit meinem Partner Zusammen auf, der Name bedeutet genau das: zusammen. Diese Marke ist eine Hommage an unsere Beziehung: Wir glauben, dass die wichtigsten Menschen im Alltag am wenigsten Aufmerksamkeit bekommen, deshalb haben wir ein Kartenspiel entwickelt, das für einen Abend das Handy verstummen lässt und dem Gespräch Raum gibt. Die Fragen haben wir selbst zusammengestellt, und bevor wir sie irgendjemandem geben, haben wir sie natürlich zuerst selbst ausprobiert :) Jetzt suchen wir zwanzig Paare, die uns sagen, was sie davon halten.",
        },
      ],
    },
    footer: { tagline: "Zusammen · das-zusammen.ch" },
    stickyCta: "Set anfordern",
  },
  hu: {
    langLabel: "HU",
    nav: { eyebrow: "ZUSAMMEN · FIRST 20" },
    hero: {
      eyebrow: "ZUSAMMEN · FIRST 20",
      title: "Mikor volt utoljára, hogy igazán egymásra figyeltetek?",
      subtitle: "Egy beszélgetőkártya-pakli két embernek. Egy este telefon és zaj nélkül, csak ti ketten.",
      cta: "Kérem a készletet",
      microline: "20 alapítói hely · az Első este készlet ingyenes · a teljes pakli alapítói áron: 24 CHF",
    },
    steps: {
      title: "Így működik",
      items: [
        {
          title: "Jelentkezz",
          body: "Pár adat, fizetés nélkül.",
        },
        {
          title: "Kapd meg a készletet",
          body: "Azonnal e-mailben: útmutató, 9 kártya és egy telefon-parkoló cédula nyomtatható PDF-ben.",
        },
        {
          title: "Töltsetek el egy estét",
          body: "Egy óra, telefon nélkül.",
        },
        {
          title: "Mondd el, milyen volt",
          body: "Utána megrendelheted a teljes, 58 lapos paklit alapítói áron (24 CHF, számla a feladáskor).",
        },
      ],
    },
    cards: {
      title: "58 kártya. Egy ígéret.",
      suits: [
        { icon: "heart", name: "Szív · Szerelem", question: "„Mi volt az első dolog, ami megfogott benned?”" },
        { icon: "cup", name: "Csésze · Hétköznapok", question: "„Mi a kedvenc közös hétköznapi szokásunk?”" },
        {
          icon: "mountain",
          name: "Hegy · Álmok és növekedés",
          question: "„Melyik közös álmunkat valósítanád meg?”",
        },
        { icon: "lake", name: "Tó · Emlékek és hála", question: "„Melyik közös emléket őrzöd a legjobban?”" },
      ],
      extra:
        "Öt Wild kártya, amely kimozdít a megszokottból, és egy Gold kártya a végére: Egy levél. Egy év. Egy ígéret.",
    },
    why: {
      title: "Miért csak 20 pár?",
      body: "Mert most tanulunk. Az első húsz párral együtt csiszoljuk tökéletesre a paklit: ti mondjátok meg, mi működik, mi nem, és melyik kérdés ért a legmélyebbre.",
      youGetLabel: "Ti kaptok:",
      youGet: "azonnal az Első este készletet, és az első 20 megrendelő alapítói áron (24 CHF) kapja a teljes paklit.",
      weAskLabel: "Mi kérünk:",
      weAsk: "egy estét és 10 perc őszinte visszajelzést. Fotót csak akkor, ha ti is szeretnétek.",
    },
    signup: {
      title: "Foglaljátok le a helyeteket.",
      counter: (taken) => `${taken} / 20 hely foglalt`,
      counterFallback: "20 hely",
      firstName: "Keresztnév",
      firstNamePlaceholder: "A te keresztneved",
      email: "E-mail",
      emailPlaceholder: "te@pelda.hu",
      partnerFirstName: "Partnered keresztneve",
      partnerFirstNamePlaceholder: "opcionális",
      languageQuestion: "Melyik nyelvű paklit választanátok?",
      languageOptions: { hu: "Magyar", de: "Német", en: "Angol" },
      howHeardQuestion: "Honnan hallottál rólunk?",
      howHeardOptions: {
        instagram: "Instagram",
        friend: "Ismerős",
        facebook_group: "Facebook-csoport",
        other: "Egyéb",
      },
      consentPrefix: "Hozzájárulok, hogy a Zusammen e-mailben értesítsen a First 20 programról. Bármikor leiratkozhatok. ",
      consentLinkText: "Adatvédelmi tájékoztató",
      consentSuffix: "",
      submit: "Kérem a készletet",
      submitting: "Küldés…",
      footnote:
        "A jelentkezés díjmentes és nem kötelező. A teljes pakli megrendelése csak az este után lehetséges, az sem kötelező érvényű: a számlát a feladáskor küldjük.",
      success:
        "Köszönjük! Elküldtük az Első este készletet az e-mail címedre. Nézd meg a spam mappát is.",
      alreadyRegistered: "Ez az e-mail cím már jelentkezett — nem felejtettünk el titeket.",
      errors: {
        firstName: "Kérjük, add meg a keresztneved.",
        email: "Kérjük, adj meg egy érvényes e-mail címet.",
        consent: "A folytatáshoz kérjük, fogadd el a hozzájárulást.",
        rateLimited: "Túl sok próbálkozás — kérjük, próbáld újra egy óra múlva.",
        generic: "Valami hiba történt. Kérjük, próbáld újra egy pillanat múlva.",
      },
    },
    faq: {
      title: "GYIK",
      items: [
        {
          q: "Mibe kerül?",
          a: "Az Első este készlet ingyenes. A teljes, 58 lapos pakli az első 20 megrendelőnek alapítói áron kapható: 24 CHF. A rendelés az este után lehetséges és nem kötelező érvényű; a számlát a feladáskor küldjük.",
        },
        {
          q: "Mikor kapjuk meg?",
          a: "A készletet a jelentkezés után azonnal e-mailben kapod. A teljes pakli szállításának pontos időpontját még nem tudjuk; erről a megrendelőket elsőként értesítjük.",
        },
        {
          q: "Mi történik, ha betelik a 20 hely?",
          a: "A készletet ilyenkor is megkapod. A 21. megrendeléstől várólistára kerülsz, és elsőként értesülsz a következő körről.",
        },
        {
          q: "Milyen nyelven?",
          a: "Az Első este készlet magyarul, németül és angolul is elérhető, a jelentkezéskor választhatsz. A teljes pakli első köre német nyelvű lesz; a magyar és az angol a jelentkezések alapján következik.",
        },
        {
          q: "Mit kezdtek az adataimmal?",
          a: "Csak a programról írunk, harmadik félnek nem adjuk ki. Bármikor leiratkozhatsz.",
        },
        {
          q: "Kik vagytok?",
          a: "Barbara vagyok, magyarként élek Svájcban, és a párommal együtt építjük a Zusammen-t — a név németül azt jelenti: együtt. Ez a márka a kapcsolatunk tiszteletére készült: hisszük, hogy a legfontosabb emberekre jut a legkevesebb figyelem a hétköznapokban, ezért készítettünk egy paklit, amely egy estére elhallgattatja a telefont, és helyet ad a beszélgetésnek. A kérdéseket mi állítottuk össze, és mielőtt bárkinek odaadnánk, mi magunk már kipróbáltuk :) Most húsz párt keresünk, hogy ti is elmondjátok, mit gondoltok róla.",
        },
      ],
    },
    footer: { tagline: "Zusammen · das-zusammen.ch" },
    stickyCta: "Kérem a készletet",
  },
  en: {
    langLabel: "EN",
    nav: { eyebrow: "ZUSAMMEN · FIRST 20" },
    hero: {
      eyebrow: "ZUSAMMEN · FIRST 20",
      title: "When did you last really listen to each other?",
      subtitle: "A conversation card deck for two people. One evening without phones or noise — just the two of you.",
      cta: "Get the kit",
      microline: "20 founders' spots · the First Evening Kit is free · the full deck at the founders' price: CHF 24",
    },
    steps: {
      title: "How it works",
      items: [
        {
          title: "Sign up",
          body: "A few details, no payment.",
        },
        {
          title: "Get your kit",
          body: "Right away by email: a guide, 9 cards and a phone parking slip as a printable PDF.",
        },
        {
          title: "Spend an evening",
          body: "One hour, no phones.",
        },
        {
          title: "Tell us how it went",
          body: "Afterwards you can order the full 58-card deck at the founders' price (CHF 24, invoice only when it ships).",
        },
      ],
    },
    cards: {
      title: "58 cards. One promise.",
      suits: [
        { icon: "heart", name: "Heart · Love", question: "“What was the first thing that drew me to you?”" },
        { icon: "cup", name: "Cup · Everyday life", question: "“What's our favourite everyday ritual together?”" },
        { icon: "mountain", name: "Mountain · Dreams & growth", question: "“Which shared dream would you make real?”" },
        { icon: "lake", name: "Lake · Memories & gratitude", question: "“Which shared memory do you treasure most?”" },
      ],
      extra:
        "Plus five Wild Cards that pull you out of routine, and one Gold Card at the end: One letter. One year. One promise.",
    },
    why: {
      title: "Why only 20 couples?",
      body: "Because we're still learning. Together with the first twenty couples, we're refining the deck until it's right — you tell us what works, what doesn't, and which question went deepest.",
      youGetLabel: "You get:",
      youGet: "the First Evening Kit right away, and the first 20 orders get the full deck at the founders' price (CHF 24).",
      weAskLabel: "We ask for:",
      weAsk: "one evening and 10 minutes of honest feedback. A photo only if you'd like to.",
    },
    signup: {
      title: "Reserve your spot.",
      counter: (taken) => `${taken} / 20 spots taken`,
      counterFallback: "20 spots",
      firstName: "First name",
      firstNamePlaceholder: "Your first name",
      email: "Email",
      emailPlaceholder: "you@example.com",
      partnerFirstName: "Partner's first name",
      partnerFirstNamePlaceholder: "optional",
      languageQuestion: "Which language would you like the deck in?",
      languageOptions: { en: "English", de: "German", hu: "Hungarian" },
      howHeardQuestion: "How did you hear about us?",
      howHeardOptions: { instagram: "Instagram", friend: "A friend", facebook_group: "Facebook group", other: "Other" },
      consentPrefix: "I agree that Zusammen may email me about the First 20 program. I can unsubscribe anytime. ",
      consentLinkText: "Privacy policy",
      consentSuffix: "",
      submit: "Get the kit",
      submitting: "Sending…",
      footnote:
        "Signing up is free and non-binding. You can order the full deck only after the evening, and that is non-binding too: the invoice comes when it ships.",
      success: "Thank you! We've emailed you the First Evening Kit. Please check your spam folder too.",
      alreadyRegistered: "This email is already registered — we haven't forgotten you.",
      errors: {
        firstName: "Please enter your first name.",
        email: "Please enter a valid email address.",
        consent: "Please confirm the consent to continue.",
        rateLimited: "Too many attempts — please try again in an hour.",
        generic: "Something went wrong. Please try again in a moment.",
      },
    },
    faq: {
      title: "FAQ",
      items: [
        {
          q: "What does it cost?",
          a: "The First Evening Kit is free. The full 58-card deck is available to the first 20 orders at the founders' price of CHF 24. You can order after the evening, non-binding; we send the invoice only when it ships.",
        },
        {
          q: "When will we get it?",
          a: "You get the kit by email right after signing up. We can't give an exact delivery date for the full deck yet; everyone who orders hears first.",
        },
        {
          q: "What happens if the 20 spots fill up?",
          a: "You still get the kit. From the 21st order on, you join the waiting list and hear first about the next round.",
        },
        {
          q: "What language?",
          a: "The First Evening Kit is available in German, Hungarian and English; you choose when you sign up. The first run of the full deck will be in German; Hungarian and English follow depending on demand.",
        },
        {
          q: "What do you do with my data?",
          a: "We only write about the program and never share it with third parties. You can unsubscribe anytime.",
        },
        {
          q: "Who are you?",
          a: "I'm Barbara — Hungarian by birth, now living in Switzerland, building Zusammen together with my partner. The name means exactly that: together. This brand is a tribute to our relationship: we believe the people who matter most get the least attention in everyday life, so we made a deck of cards that quiets the phone for one evening and makes room for real conversation. We wrote the questions ourselves, and before handing them to anyone else, we tried them out on ourselves first :) Now we're looking for twenty couples to tell us what they think.",
        },
      ],
    },
    footer: { tagline: "Zusammen · das-zusammen.ch" },
    stickyCta: "Get the kit",
  },
};

export function isFirst20Lang(value: string | undefined | null): value is First20Lang {
  return value === "de" || value === "hu" || value === "en";
}
