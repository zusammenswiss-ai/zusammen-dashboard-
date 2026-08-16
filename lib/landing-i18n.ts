// Translations for /landing (the public customer-facing funnel).
// German and English only — the founder dashboard itself is Hungarian,
// but this page is customer-facing for a Swiss/German-speaking audience.
import type { LandingLang } from "./supabase/types";

export type { LandingLang };

export const LANDING_SCREENS = [
  "hero",
  "story",
  "card",
  "letter",
  "box",
  "seasons",
  "community",
  "survey",
  "thanks",
] as const;
export type LandingScreen = (typeof LANDING_SCREENS)[number];

export const landingT = {
  de: {
    hero: {
      eyebrow: "Zusammen · Where conversations become memories",
      sub: "Verlangsame. Verbinde dich. Genieße.",
      intro:
        "Ein Kartenspiel, das darauf aufbaut, das Handy wegzulegen — keine App, keine Erinnerung, sondern ein physisches Ritual, das du mit jemandem an einem Tisch erlebst. Bevor wir irgendetwas fertigstellen, möchten wir wissen: Braucht ihr das wirklich?",
      phoneTitle: "Das Kernerlebnis: handyfrei",
      phoneBody:
        "Bevor ihr eine Karte zieht, legt ihr eure Handys in einen gemeinsamen Beutel. Alles, was danach kommt, dreht sich um diesen Moment.",
      timenote:
        "Der ganze Weg: ca. 6–8 Minuten — oder springe direkt zu den Karten, wenn du jetzt keine Zeit für die Geschichte hast.",
      storyButton: "Warum ich das gebaut habe, und wohin es führt",
      skipLink: "Oder springe direkt zu den Karten →",
    },
    story: {
      eyebrow: "Die Geschichte der Gründerin",
      title: "Es begann mit einem einfachen Gedanken.",
      pullq: "Was würde passieren, wenn wir wieder Zeit füreinander hätten?",
      p1: "ZUSAMMEN entstand aus der Erkenntnis, dass wir zwar ständig mit der Welt verbunden sind, aber oft am wenigsten mit den Menschen sprechen, die uns wirklich wichtig sind.",
      lines1: ["Eine Nachricht.", "Eine Benachrichtigung.", "Noch ein Tag."],
      p2: "Und dabei vergessen wir, innezuhalten.",
      p3: "Deshalb habe ich mir ZUSAMMEN erträumt.",
      p4: "Ich wollte nicht einfach nur ein Kartenspiel erschaffen. Ich wollte ein Erlebnis bauen, das hilft, wieder zueinander zu finden.",
      lines2: [
        "Bei einem Kaffee.",
        "Durch eine Frage.",
        "Bei einem gemeinsamen Spaziergang.",
        "In einem Brief.",
        "In einem stillen Moment.",
      ],
      h3: "Was ZUSAMMEN bedeutet",
      p5: "Der Name ist Programm: Zusammen bedeutet gemeinsam, verbunden, füreinander da.",
      p6: "Für mich bedeutet das mehr als nur ein Wort.",
      p7: "Es bedeutet, wirklich füreinander da zu sein.",
      p8: "So entstand das erste ZUSAMMEN-Kartenspiel: ein Offline-Erlebnis, das dazu einlädt, die Handys wegzulegen, langsamer zu werden und einander etwas zu schenken, das immer seltener wird:",
      emph: "Aufmerksamkeit.",
      p9: "Hier beginnt die Geschichte.",
      p10: "Die erste Version von ZUSAMMEN ist noch eine Founder Test Edition.",
      p11: "Sie ist nicht perfekt geboren.",
      p12: "Ich möchte sie gemeinsam mit euch gestalten.",
      p13: "Die Rückmeldungen, Geschichten, gemeinsamen Momente und Ideen der ersten Spieler:innen werden das Produkt formen, aus dem später eine echte ZUSAMMEN-Kollektion entstehen kann.",
      p14: "Das Ziel ist nicht, möglichst viele Karten zu ziehen.",
      p15: "Sondern möglichst viele echte gemeinsame Momente zu erleben.",
      p16: "Und vielleicht entsteht aus diesen Momenten eines Tages auch ein Ort.",
      p17: "Ein Ort in der Nähe des Thunersees.",
      p18: "Ein Café, in dem Menschen sich zueinandersetzen.",
      emphgreen: "Café to Connect.",
      closing: "Aber das ist erst der Anfang der Geschichte.",
      signatureRole: "Gründerin, ZUSAMMEN",
      cta: "Alles klar, lass es uns ausprobieren",
    },
    card: {
      drawNext: "Ziehe die nächste Karte",
      drawLast: "Weiter zur Gold Card",
      deck: [
        { type: "suit" as const, q: "Was war das Erste, das dich an mir fasziniert hat?" },
        {
          type: "wild" as const,
          icon: "☕",
          name: "Coffee Break",
          tag: '"Pause. Brew. Continue."',
          task: "Das Spiel pausiert. Macht euch gegenseitig einen Kaffee oder Tee. Erst danach geht es weiter.",
        },
        { type: "suit" as const, q: "Wie hoffst du, dass unsere Beziehung in zehn Jahren aussehen wird?" },
      ],
    },
    letter: {
      goldTitle: "Gold Card",
      goldPrompt: "Im echten Kartenspiel startet diese Karte ein jahrelanges Brief-Ritual.",
      context:
        "In der vollständigen Version löst diese Karte vier versiegelte Briefe aus, die einmal pro Quartal geschrieben werden — die ihr erst öffnet, wenn das Café to Connect eröffnet. Jetzt bekommst du nur einen kleinen Vorgeschmack:",
      question: "Was möchtest du jemandem, den du liebst, jetzt versprechen?",
      placeholder: "Schreib ein paar Zeilen...",
      privacy:
        "Was du schreibst, wird anonym auf der nächsten Seite auch anderen gezeigt — schreib nichts Identifizierendes hinein.",
      cta: "Weiter",
    },
    box: {
      title: "Was soll in die Box?",
      lead: "Das wird ein einzigartiges Erlebnis, kein gewöhnliches Kartenspiel — hilf mit zu entscheiden, was hineinkommt. Wähle aus, was du gerne sehen würdest (so viele wie du möchtest).",
      items: [
        {
          key: "connection-cards",
          locked: true,
          name: "Connection Cards",
          desc: "52 Fragen — das ist immer dabei, das hast du gerade ausprobiert.",
        },
        {
          key: "travel-pouch",
          name: "Travel Pouch",
          desc: 'Ein gemeinsamer "Handy-Beutel" — hier landen die Handys, bevor ihr beginnt.',
        },
        {
          key: "memory-cards",
          name: "Memory Cards",
          desc: "Leere Karten — ihr schreibt den Moment von Hand auf, statt ihn zu fotografieren.",
        },
        {
          key: "connection-passport",
          name: "Connection Passport",
          desc: "Ein kleines Heft, in dem ihr eure gemeinsamen Rituale festhaltet — Datum, Ort, Unterschrift.",
        },
        {
          key: "wax-seal-kit",
          name: "Wachssiegel-Briefset",
          desc: "Umschläge und Siegelwachs für die Gold-Card-Briefe.",
        },
        {
          key: "premium-pen",
          name: "Premium-Stift",
          desc: "Ein Gegenstand, der nur für dieses Ritual gedacht ist.",
        },
      ],
      cta: "Weiter",
    },
    seasons: {
      eyebrow: "Das ganze Jahr an eurer Seite",
      title: "Vier Jahreszeiten, vier Erlebnisse",
      intro:
        "Zusammen ist kein einmaliger Abend — es begleitet den Alltag in unterschiedlicher Form, während sich die Jahreszeiten ändern.",
      cards: [
        {
          key: "spring",
          title: "Frühling — Wachstum",
          desc: "Neue Fragen zum Neubeginn: Was möchtet ihr dieses Jahr gemeinsam anfangen?",
        },
        {
          key: "summer",
          title: "Sommer — Abenteuer",
          desc: "Picknick im Freien, leichtes Lachen — die Karten reisen mit euch, wohin ihr auch geht.",
        },
        {
          key: "autumn",
          title: "Herbst — Wurzeln",
          desc: "Ruhigere Abende, tiefere Gespräche — ein Rückblick auf das, was ihr gemeinsam aufgebaut habt.",
        },
        {
          key: "winter",
          title: "Winter — Wärme",
          desc: "Heißer Kaffee, innige Momente — die persönlichsten Fragen der Weihnachtszeit.",
        },
      ],
      journeyEyebrow: "Kein Massenprodukt",
      journeyP1:
        "Das Ziel ist nicht, es einmal durchzuspielen und wegzulegen. Jede Karte ist so gestaltet, dass sie jahrelang in euren Händen bleibt — sie unterhält nicht nur für einen Abend, sondern schenkt einen Moment, den ihr immer wieder erleben könnt.",
      journeyP2:
        "Wer mitmacht, kann sich auf Überraschungen, kleine Abenteuer und Fortsetzungen freuen — das ist eine Reise, die nicht endet, wenn ihr das Kartenspiel zum ersten Mal durchgespielt habt.",
      cta: "Weiter",
    },
    community: {
      eyebrow: "Nicht nur ein Produkt",
      title: "Wenn du mitmachst, wirst du Teil einer Community",
      intro:
        "Zusammen ist der erste Schritt einer längeren Reise. Wer dieses Kartenspiel kauft, erhält mit der Zeit auch eine Einladung zur Fortsetzung:",
      items: [
        {
          key: "picnic",
          icon: "🧺",
          name: "Picknick-Treffen",
          desc: "Gemeinsame Auszeiten mit anderen, die genauso über Verbindung denken.",
        },
        {
          key: "founding-circle",
          icon: "🤝",
          name: "Founding-Circle-Community",
          desc: "Frühe Mitgliedschaft, bevorzugter Zugang zu neuen Editionen und Events.",
        },
        {
          key: "opening",
          icon: "☕",
          name: "Eine Einladung zur Eröffnung",
          desc: "Wenn das Café to Connect eines Tages eröffnet, erhalten die frühen Unterstützer:innen als Erste eine Einladung.",
        },
      ],
      cta: "Weiter zu den Fragen",
    },
    survey: {
      title: "Was denkst du?",
      lead: "Das ist keine offizielle Bestellung, es hilft uns nur zu entscheiden, was sich lohnt zu produzieren.",
      q1Label: "Würdest du das für dich selbst oder als Geschenk kaufen?",
      q1Options: ["Ja, sofort", "Vielleicht, kommt drauf an", "Wahrscheinlich nicht"],
      q2Label: "Wie viel würdest du für so ein Paket bezahlen?",
      q2Options: ["Unter 20 CHF", "20–35 CHF", "35–50 CHF", "Über 50 CHF"],
      q3Label: "Was würde das für dich wirklich besonders machen?",
      q3Hint: "Stell dir kein gewöhnliches Kartenspiel vor — was möchtest du darin sehen?",
      q3Placeholder: "z. B. ein zusätzliches Ritual, ein Extra-Objekt, ein anderes Thema...",
      emailLabel: "E-Mail (optional) — wir sagen dir Bescheid, wenn es losgeht",
      emailPlaceholder: "du@email.com",
      submit: "Antwort senden",
      alertIncomplete: "Bitte beantworte beide Fragen, bevor du absendest.",
    },
    thanks: {
      title: "Danke!",
      subtitle: "Dein Feedback hilft uns zu entscheiden, was sich lohnt zu produzieren.",
      othersHeading: "Was andere geschrieben haben",
      loading: "Lädt...",
      firstMessage: "Du wirst der/die Erste sein — danke, dass du es geteilt hast.",
    },
    founder: {
      passwordPrompt: "Gründer-Passwort:",
      wrongPassword: "Falsches Passwort.",
      modalTitle: "Zusammengefasste Antworten",
      loading: "Lädt...",
      totalResponses: "Gesamtantworten",
      lettersWritten: "Geschriebene Briefe",
      emailsProvided: "Angegebene E-Mails",
      wouldBuy: "Würdest du kaufen?",
      priceSensitivity: "Preissensibilität",
      boxWishes: "Was sie sich in der Box wünschen",
      ideasWritten: "Ideen, die sie geschrieben haben",
      close: "Schließen",
      loadError: "Beim Laden der Daten ist ein Fehler aufgetreten.",
      noResponses: "Es gibt noch keine Antworten.",
      link: "Gründeransicht",
    },
  },
  en: {
    hero: {
      eyebrow: "Zusammen · Where conversations become memories",
      sub: "Slow down. Connect. Enjoy.",
      intro:
        "A deck of cards built around putting your phone down — not an app, not a reminder, but a physical ritual you experience with someone at a table. Before we make anything final, we want to know: do you really need this?",
      phoneTitle: "The core experience: no phones",
      phoneBody:
        "Before you draw a card, you put your phones into a shared pouch. Everything that follows is built around that moment.",
      timenote:
        "Full journey: about 6–8 minutes — or jump straight to the cards if you don't have time for the story right now.",
      storyButton: "Why I built this, and where it's going",
      skipLink: "Or jump straight to the cards →",
    },
    story: {
      eyebrow: "The founder's story",
      title: "It started with a simple thought.",
      pullq: "What would happen if we had time for each other again?",
      p1: "ZUSAMMEN was born from a simple realization: while we're constantly connected to the world, we often talk least to the people who matter most.",
      lines1: ["A message.", "A notification.", "Another day."],
      p2: "And in the middle of it, we forget to stop.",
      p3: "That's why I dreamed up ZUSAMMEN.",
      p4: "I didn't just want to create a card game. I wanted to build an experience that helps people find their way back to each other.",
      lines2: [
        "Over a coffee.",
        "Through a question.",
        "On a walk together.",
        "In a letter.",
        "In a quiet moment.",
      ],
      h3: "What ZUSAMMEN means",
      p5: "Zusammen is German for: together.",
      p6: "For me, it means more than just a word.",
      p7: "It means truly being present for each other.",
      p8: "That's how the first ZUSAMMEN deck was born: an offline experience that invites you to put your phones away, slow down, and give each other something that's becoming rarer and rarer:",
      emph: "attention.",
      p9: "That's where the story begins.",
      p10: "The first version of ZUSAMMEN is still just a Founder Test Edition.",
      p11: "It's not born perfect.",
      p12: "I want to shape it together with you.",
      p13: "The feedback, stories, shared moments and ideas of the first players will shape the product that could later become a real ZUSAMMEN collection.",
      p14: "The goal isn't to draw as many cards as possible.",
      p15: "It's to experience as many real moments together as possible.",
      p16: "And maybe, one day, these moments will give rise to a place too.",
      p17: "A place near Lake Thun.",
      p18: "A café where people sit down with each other.",
      emphgreen: "Café to Connect.",
      closing: "But this is only the beginning of the story.",
      signatureRole: "Founder, ZUSAMMEN",
      cta: "Alright, let's try it",
    },
    card: {
      drawNext: "Draw the next card",
      drawLast: "Continue to the Gold Card",
      deck: [
        { type: "suit" as const, q: "What was the first thing that caught your attention about me?" },
        {
          type: "wild" as const,
          icon: "☕",
          name: "Coffee Break",
          tag: '"Pause. Brew. Continue."',
          task: "The game pauses. Make each other a coffee or tea. Only continue afterward.",
        },
        { type: "suit" as const, q: "What do you hope our relationship will look like in ten years?" },
      ],
    },
    letter: {
      goldTitle: "Gold Card",
      goldPrompt: "In the real deck, this card kicks off a letter ritual that lasts for years.",
      context:
        "In the full version, this card kicks off four sealed letters written once a season — which you only open once Café to Connect opens. Right now you're just getting a small taste of it:",
      question: "What would you like to promise someone you love right now?",
      placeholder: "Write a few lines...",
      privacy:
        "What you write will be shown anonymously to others on the next page — don't include anything identifying.",
      cta: "Continue",
    },
    box: {
      title: "What should be in the box?",
      lead: "This is going to be a unique experience, not just a standard card game — help decide what goes in it. Pick whatever you'd like to see (select as many as you want).",
      items: [
        {
          key: "connection-cards",
          locked: true,
          name: "Connection Cards",
          desc: "52 questions — this is always included, you just tried it.",
        },
        {
          key: "travel-pouch",
          name: "Travel Pouch",
          desc: 'A shared "phone pouch" — where phones go before you begin.',
        },
        {
          key: "memory-cards",
          name: "Memory Cards",
          desc: "Blank cards — you write down the moment by hand, instead of photographing it.",
        },
        {
          key: "connection-passport",
          name: "Connection Passport",
          desc: "A little booklet where you log your shared rituals — date, place, signature.",
        },
        {
          key: "wax-seal-kit",
          name: "Wax-Seal Letter Kit",
          desc: "Envelopes and sealing wax for the Gold Card letters.",
        },
        {
          key: "premium-pen",
          name: "Premium Pen",
          desc: "An object meant only for this ritual.",
        },
      ],
      cta: "Continue",
    },
    seasons: {
      eyebrow: "With you all year round",
      title: "Four seasons, four experiences",
      intro:
        "Zusammen isn't a one-off evening — it shows up in everyday life in different forms as the seasons change.",
      cards: [
        {
          key: "spring",
          title: "Spring — Growth",
          desc: "New questions about renewal: what would you like to start together this year?",
        },
        {
          key: "summer",
          title: "Summer — Adventure",
          desc: "Picnics outdoors, easy laughter — the cards travel with you, wherever you go.",
        },
        {
          key: "autumn",
          title: "Autumn — Roots",
          desc: "Quieter evenings, deeper conversations — looking back on what you've built together.",
        },
        {
          key: "winter",
          title: "Winter — Warmth",
          desc: "Hot coffee, intimate moments — the most personal questions of the holiday season.",
        },
      ],
      journeyEyebrow: "Not a mass product",
      journeyP1:
        "The goal isn't to play through it once and put it away. Every card is designed to stay in your hands for years — it doesn't just entertain for one evening, it gives you a moment you can relive again and again.",
      journeyP2:
        "Whoever joins can look forward to surprises, small adventures, and sequels — this is a journey that doesn't end when you finish the deck for the first time.",
      cta: "Continue",
    },
    community: {
      eyebrow: "Not just a product",
      title: "If you join, you become part of a community",
      intro:
        "Zusammen is the first step of a longer journey. Whoever buys this deck will, over time, get an invitation to what comes next:",
      items: [
        {
          key: "picnic",
          icon: "🧺",
          name: "Picnic meetups",
          desc: "Shared downtime with others who think about connection the same way.",
        },
        {
          key: "founding-circle",
          icon: "🤝",
          name: "Founding Circle community",
          desc: "Early membership, priority access to new releases and events.",
        },
        {
          key: "opening",
          icon: "☕",
          name: "An invitation to the opening",
          desc: "When Café to Connect eventually opens, early supporters will be the first to receive an invitation.",
        },
      ],
      cta: "Continue to the questions",
    },
    survey: {
      title: "What do you think?",
      lead: "This isn't an official order, it just helps us decide what's worth making.",
      q1Label: "Would you buy this for yourself or as a gift?",
      q1Options: ["Yes, right away", "Maybe, depends", "Probably not"],
      q2Label: "How much would you pay for a package like this?",
      q2Options: ["Under 20 CHF", "20–35 CHF", "35–50 CHF", "Over 50 CHF"],
      q3Label: "What would make this truly special for you?",
      q3Hint: "Don't picture a standard card game — what would you like to see in it?",
      q3Placeholder: "e.g. an extra ritual, an add-on object, a different theme...",
      emailLabel: "Email (optional) — we'll let you know when it launches",
      emailPlaceholder: "you@email.com",
      submit: "Submit response",
      alertIncomplete: "Please answer both questions before submitting.",
    },
    thanks: {
      title: "Thank you!",
      subtitle: "Your feedback helps us decide what's worth making.",
      othersHeading: "What others wrote",
      loading: "Loading...",
      firstMessage: "You'll be the first — thank you for sharing.",
    },
    founder: {
      passwordPrompt: "Founder password:",
      wrongPassword: "Incorrect password.",
      modalTitle: "Aggregated responses",
      loading: "Loading...",
      totalResponses: "Total responses",
      lettersWritten: "Letters written",
      emailsProvided: "Emails provided",
      wouldBuy: "Would you buy?",
      priceSensitivity: "Price sensitivity",
      boxWishes: "What they want in the box",
      ideasWritten: "Ideas they wrote",
      close: "Close",
      loadError: "An error occurred while loading the data.",
      noResponses: "There are no responses yet.",
      link: "founder view",
    },
  },
};
