// Content pool for the "Meglepetés kérdés" (Surprise Question) card draw
// on the Személyes rituálé page. Authored directly as static Hungarian
// content — no pre-existing 58-card text source exists anywhere in the
// codebase (card_assets/Kártya-fájlok only stores print-ready ZIP/Word
// files, not queryable per-card text; landing-i18n.ts's card.deck has
// only 3 DE/EN sample entries) — so this is the canonical pool.
//
// Deliberately disjoint from the 5 fixed Wild Card names (Coffee Break,
// Silence, Memory, Adventure, Gratitude — see WildCardName in
// lib/supabase/types.ts) and from the 3 fixed Gold Card Letters ritual
// questions hard-coded in the "rituálé-útmutató" panel — this pool is
// plain surprise-question text only.

export const SURPRISE_QUESTIONS: readonly string[] = [
  "Mi az a pillanat kettőnk között, amit ha újra átélhetnél, változtatás nélkül megismételnél?",
  "Mikor éreztem magam a legbüszkébbnek rád az elmúlt hónapban?",
  "Van olyan apróság, amit minden nap megteszek érted, és talán észre sem veszed?",
  "Mi az, amit most jobban értékelek benned, mint egy éve?",
  "Ha egy napot kizárólag ketten tölthetnénk, mindenféle kötelezettség nélkül, mit csinálnánk?",
  "Mi az a közös szokásunk, amit a legjobban szeretek?",
  "Milyen félelmet oldottál fel bennem azzal, hogy mellettem vagy?",
  "Mikor nevettem veled a legutóbb annyira, hogy fájt a hasam?",
  "Mi az, amit szeretnék, ha többször mondanánk egymásnak?",
  "Melyik közös emlékünk melegít fel, ha rossz napom van?",
  "Mit tanultam tőled, amit magamtól sosem tanultam volna meg?",
  "Ha egy szóval kellene leírnom, milyen érzés veled lenni, melyiket választanám?",
  "Mi az, amiben a legjobban támogatsz, még ha ezt sosem mondtam is ki?",
  "Melyik közös álmunk áll most a legközelebb ahhoz, hogy valóra váljon?",
  "Mi az a apró rituálénk, amit sosem szeretnék elhagyni?",
  "Mikor éreztem úgy utoljára, hogy pontosan értesz, szavak nélkül is?",
  "Mi az, amit szeretnék, ha tudnál rólam, de még sosem mondtam el?",
  "Ha visszamehetnénk az első közös évünkbe, mit mondanék akkori magamnak rólad?",
  "Mi az a hely, ahova visszavágyom veled?",
  "Milyen erősségemet látod bennem, amit én magam nehezen ismerek el?",
  "Mi az, amit most a legjobban várok a közös jövőnkből?",
  "Melyik nehéz pillanatunkból lettünk a legerősebbek együtt?",
  "Mi az egyetlen dolog, amiért ma külön hálát adnék neked?",
  "Ha egy közös hagyományt alapíthatnánk most, mi lenne az?",
  "Mi az, amiben szeretnék bátrabb lenni melletted?",
  "Milyen apró gesztust szeretnék, ha gyakrabban kapnék tőled?",
  "Mi az a beszélgetés, amit még mindig szívesen folytatnék veled?",
  "Mikor éreztem úgy, hogy otthon vagyok, csak mert te ott voltál?",
  "Mi az, amit régóta szeretnék megkérdezni tőled, de eddig nem tettem?",
  "Melyik közös tervünk izgat most a legjobban?",
  "Mi az, amit a barátságunkban a legjobban szeretek, a párkapcsolatunkon túl?",
  "Milyen bocsánatkérést szeretnék még kimondani, amit eddig magamban tartottam?",
  "Mi az, amiben szeretném, ha jobban megbíznék magamban — a te szemeddel nézve?",
  "Ha a következő évünket egy mondatban kellene megálmodnom, mi lenne az?",
  "Mi az az apró változás rajtam, amit észrevettél, és sosem mondtál el?",
  "Melyik közös utazásunk emléke jut eszembe a leggyakrabban?",
  "Mi az, amiért ma szeretnék bocsánatot kérni, akkor is, ha apróság?",
  "Milyen közös célt szeretnék, ha együtt tűznénk ki most?",
  "Mi az a pillanat, amikor a legbiztonságosabban éreztem magam veled?",
  "Melyik szokásod hiányozna a legjobban, ha egy hétig távol lennél?",
  "Mi az, amit szeretnék, ha ma este, lefekvés előtt tudnál rólam?",
  "Ha egy ajándékot adhatnék neked, ami nem tárgy, mi lenne az?",
  "Mi az a közös nehézség, amit büszkén oldottunk meg együtt?",
  "Melyik pillanatban éreztem úgy, hogy csapat vagyunk, nem csak pár?",
  "Mi az, amit a jövő évi magunknak üzennék most kettőnkről?",
  "Milyen apró örömöt szeretnék gyakrabban megosztani veled?",
  "Mi az, amiben szeretném, ha jobban kimutatnám az irántad érzett szeretetet?",
  "Melyik közös barátunk vagy családtagunk mellett éreztem, hogy jó csapat vagyunk?",
  "Mi az egyik legjobb döntés, amit együtt hoztunk?",
  "Ha most újra megkérnélek, hogy legyél a párom, mit mondanék el, miért téged választanálak?",
  "Mi az a kérdés, amit szeretnék, ha te tennél fel nekem ma este?",
  "Melyik pillanatban láttalak a legsebezhetőbbnek, és mit éreztem akkor?",
  "Mi az, amit szeretnék, ha együtt kipróbálnánk, mielőtt az év véget ér?",
  "Milyen közös szokásunk vált idővel az egyik kedvenc dolgommá?",
  "Mi az a mondat, amit ha most kimondanál, egész nap velem maradna?",
  "Melyik pillanatban voltál a legjobban büszke ránk, kettőnkre?",
  "Mi az, amit szeretnék, ha ma este, telefon nélkül csak veled csinálnék?",
  "Ha a kapcsolatunkat egy évszakhoz hasonlítanám, melyik lenne, és miért?",
];

// Random introductory framing sentence, shown above the drawn question.
export const SURPRISE_INTROS: readonly string[] = [
  "Ma este, mielőtt lefeküdnétek, ülj le vele öt percre, és kérdezd meg:",
  "Nincs különleges alkalom — csak ti ketten, és egy kérdés, ami számít:",
  "Állj meg egy percre a nap közepén, nézz rá, és kérdezd meg:",
  "Egy csendes pillanat kettőtöknek — semmi más nem kell hozzá, csak ez:",
  "Ha ma csak egyetlen mondatot mondasz neki szívből, legyen ez a kérdés:",
  "Vacsora közben, séta közben, vagy csak úgy — tedd fel neki most:",
  "Ez a mai meghívásod egy igazi beszélgetésre:",
];

// Random closing sentence, shown after the question — every option must
// explicitly mention putting the phone down (per spec).
export const SURPRISE_OUTROS: readonly string[] = [
  "Tedd le a telefont, nézz rá, és csak figyeld, mit válaszol.",
  "Utána tedd félre a telefont — a válasz megérdemli a teljes figyelmedet.",
  "Kapcsold telefonodat némára, tedd le, és hagyj teret a válasznak.",
  "Ne fogd a telefont, amíg beszél — tedd le, és csak legyél jelen.",
];

export const SURPRISE_WARNING =
  "Ez csak a meghívó, nem a beszélgetés — a telefon egyetlen dologra való: hogy elküldd ezt az üzenetet.";

export const SURPRISE_SIGNATURE = "— Zusammen 🤎";

export function drawRandomQuestion(): { intro: string; question: string; outro: string } {
  const intro = SURPRISE_INTROS[Math.floor(Math.random() * SURPRISE_INTROS.length)];
  const question = SURPRISE_QUESTIONS[Math.floor(Math.random() * SURPRISE_QUESTIONS.length)];
  const outro = SURPRISE_OUTROS[Math.floor(Math.random() * SURPRISE_OUTROS.length)];
  return { intro, question, outro };
}

export function buildShareText(intro: string, question: string, outro: string): string {
  return `${intro}\n\n${question}\n\n${outro}\n\n${SURPRISE_SIGNATURE}`;
}
