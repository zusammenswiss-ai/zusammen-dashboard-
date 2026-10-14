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
      cta: "Platz sichern",
      microline: "20 Paare · Testen gegen ehrliches Feedback · keine Verpflichtung",
    },
    steps: {
      title: "Ein Abend. Drei Schritte.",
      items: [
        {
          title: "Legt die Handys weg.",
          body: "Keine Strafe, sondern ein Geschenk: eine Stunde, in die sich nichts und niemand zwischen euch drängt.",
        },
        {
          title: "Zieht eine Karte.",
          body: "Vier Farbfamilien, zweiundfünfzig Fragen zur Liebe, zum Alltag, zu Träumen und Erinnerungen.",
        },
        {
          title: "Hört einander zu.",
          body: "Es gibt keine richtige oder falsche Antwort — nur zwei Menschen, die einander endlich zuhören.",
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
      youGet: "das Kartenspiel gratis.",
      weAskLabel: "Wir bitten um:",
      weAsk: "einen Abend und 10 Minuten ehrliches Feedback. Ein Foto nur, wenn ihr möchtet.",
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
      submit: "Jetzt anmelden",
      submitting: "Wird gesendet…",
      success:
        "Danke, wir haben eure Anmeldung erhalten. Wir schreiben allen Bewerberinnen und Bewerbern, auch wenn die 20 Plätze inzwischen vergeben sind.",
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
        { q: "Was kostet es?", a: "Die ersten 20 Paare erhalten das Kartenspiel kostenlos." },
        {
          q: "Wann bekommen wir es?",
          a: "Einen genauen Termin wissen wir noch nicht. Wer sich anmeldet, erfährt es als Erstes — per E-Mail.",
        },
        {
          q: "In welcher Sprache?",
          a: "Die erste Runde ist auf Deutsch. Ungarisch und Englisch folgen je nach Anmeldungen.",
        },
        {
          q: "Was macht ihr mit meinen Daten?",
          a: "Wir schreiben nur über das Programm, geben nichts an Dritte weiter. Du kannst dich jederzeit abmelden.",
        },
        {
          q: "Wer seid ihr?",
          a: "Wir sind ein junges Schweizer Herzensprojekt rund um den Thunersee — gestartet, weil wir selbst wieder mehr Zeit füreinander wollten. [Hier ergänzt Barbara in 2–3 Sätzen, wer ihr seid.]",
        },
      ],
    },
    footer: { tagline: "Zusammen · das-zusammen.ch" },
    stickyCta: "Platz sichern",
  },
  hu: {
    langLabel: "HU",
    nav: { eyebrow: "ZUSAMMEN · FIRST 20" },
    hero: {
      eyebrow: "ZUSAMMEN · FIRST 20",
      title: "Mikor volt utoljára, hogy igazán egymásra figyeltetek?",
      subtitle: "Egy beszélgetőkártya-pakli két embernek. Egy este telefon és zaj nélkül, csak ti ketten.",
      cta: "Kérem a helyem",
      microline: "20 pár · kipróbálás cserébe őszinte visszajelzésért · nincs kötelezettség",
    },
    steps: {
      title: "Egy este. Három mozdulat.",
      items: [
        {
          title: "Tegyétek le a telefont.",
          body: "Nem büntetés, hanem ajándék: egy óra, amibe senki és semmi nem fér be kettőtök közé.",
        },
        {
          title: "Húzzatok egy kártyát.",
          body: "Négy színcsalád, ötvenkét kérdés a szerelemről, a hétköznapokról, az álmokról és az emlékekről.",
        },
        {
          title: "Hallgassátok meg egymást.",
          body: "Nincs jó vagy rossz válasz, csak két ember, aki végre végighallgatja a másikat.",
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
      youGet: "a paklit ingyen.",
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
      submit: "Jelentkezünk",
      submitting: "Küldés…",
      success:
        "Köszönjük, megkaptuk a jelentkezésteket. Minden jelentkezőnek írunk, akkor is, ha időközben betelt a 20 hely.",
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
        { q: "Mibe kerül?", a: "Az első 20 pár ingyen kapja a paklit." },
        { q: "Mikor kapjuk meg?", a: "Pontos időpontot még nem tudunk. A jelentkezők elsőként értesülnek, e-mailben." },
        {
          q: "Milyen nyelven?",
          a: "Az első kör német nyelvű, a magyar és az angol a jelentkezések alapján következik.",
        },
        {
          q: "Mit kezdtek az adataimmal?",
          a: "Csak a programról írunk, harmadik félnek nem adjuk ki. Bármikor leiratkozhatsz.",
        },
        {
          q: "Kik vagytok?",
          a: "Egy fiatal, szívből jövő svájci projekt vagyunk a Thuni-tó mellől — azért indítottuk, mert mi magunk is több időt akartunk egymásra szánni. [Ide kerül Barbara 2–3 mondatos bemutatkozása.]",
        },
      ],
    },
    footer: { tagline: "Zusammen · das-zusammen.ch" },
    stickyCta: "Kérem a helyem",
  },
  en: {
    langLabel: "EN",
    nav: { eyebrow: "ZUSAMMEN · FIRST 20" },
    hero: {
      eyebrow: "ZUSAMMEN · FIRST 20",
      title: "When did you last really listen to each other?",
      subtitle: "A conversation card deck for two people. One evening without phones or noise — just the two of you.",
      cta: "Claim my spot",
      microline: "20 couples · try it in exchange for honest feedback · no commitment",
    },
    steps: {
      title: "One evening. Three moves.",
      items: [
        {
          title: "Put your phones away.",
          body: "Not a punishment — a gift: one hour where nothing and no one comes between you.",
        },
        {
          title: "Draw a card.",
          body: "Four suits, fifty-two questions about love, everyday life, dreams, and memories.",
        },
        {
          title: "Listen to each other.",
          body: "There's no right or wrong answer — just two people who finally hear one another.",
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
      youGet: "the deck, free.",
      weAskLabel: "We ask for:",
      weAsk: "one evening and 10 minutes of honest feedback. A photo only if you'd like to share one.",
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
      submit: "Count us in",
      submitting: "Sending…",
      success: "Thank you — we've received your registration. We'll write to every applicant, even if the 20 spots fill up before then.",
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
        { q: "What does it cost?", a: "The first 20 couples receive the deck for free." },
        { q: "When will we get it?", a: "We don't have an exact date yet. Everyone who signs up hears first — by email." },
        { q: "What language?", a: "The first round is in German. Hungarian and English follow based on sign-ups." },
        {
          q: "What do you do with my data?",
          a: "We only write about the program and never share it with third parties. You can unsubscribe anytime.",
        },
        {
          q: "Who are you?",
          a: "We're a small Swiss project near Lake Thun, started because we wanted more real time for each other too. [Barbara adds 2–3 sentences about who you are here.]",
        },
      ],
    },
    footer: { tagline: "Zusammen · das-zusammen.ch" },
    stickyCta: "Claim my spot",
  },
};

export function isFirst20Lang(value: string | undefined | null): value is First20Lang {
  return value === "de" || value === "hu" || value === "en";
}
