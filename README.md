# Zusammen — Founder Dashboard

A personal launch-tracking dashboard for **Zusammen**, a Swiss premium
conversation-card brand. Built for a single user (the founder) — no
login system, just a private tool to track suppliers, tasks, finances,
marketing, documents, and future ideas in one place. The dashboard UI is
in Hungarian; the public `/landing` page (below) is German/English.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS · Supabase
(Postgres + Storage) · deploy target: Vercel.

## Pages (founder dashboard, Hungarian UI)

| Page | What it does |
|---|---|
| **Áttekintés** (Overview) | Organized top-to-bottom by urgency: **Mire figyelj most** (the same overdue/soon-due items as the nav's Értesítési központ, plus unread Gmail) leads the page; then the business snapshot stat cards; then **Üzleti aktivitás** (suppliers/tasks/documents/plans/orders) next to a Feladattábla mini Kanban progress widget; then, kept deliberately separate, **Személyes rituálé aktivitás** (Gold Card Letters/emlékek/Wild Cardok/Meglepetés kérdés) next to a "Következő Gold Card levél" countdown. Every item links straight to its page (tasks deep-link into their detail view) |
| **Naptár** (Calendar) | Month grid or a **Lista** (agenda, next 90 days) view — toggle top-right. Every dated item across the app: task due dates, order delivery dates, marketing seasons, Marketing tartalom-naptár scheduled posts/stories/emails/campaigns, Személyes rituálé events (next Gold Card Letter esedékesség, sealed letters, journey emlékek, teljesített Wild Cardok), supplier **contract lejárat** dates, **ismétlődő sablon** forecasts (every future occurrence, not just the next one — see Feladatok), when suppliers/documents/ideas were added, and hand-added **egyedi események** (+ Új esemény button, own edit/delete) — 11 color-coded categories, click any legend chip to hide/show that category (remembered per-browser). Click a day to see and open its events; a **task** row in that list can be dragged onto a different day cell to reschedule it. `lib/calendar-events.ts` is the single source both this page and the .ics feed below read from. |
| **Beszállítók** (Suppliers) | Full supplier profiles grouped by category — basic info (name/category/country), contact details (website/email/phone/WhatsApp), a repeatable products/services list (name, price, MOQ, note per row), a **Kapott árajánlatok** section listing every price quote received from this supplier across all kártya-fájl versions (mennyiség/egységár/összár, dátum, kiválasztva-e), contact status (contacted/replied, sent-email text, contract status + valid-until date) — a **Levelezés** panel shows the last few Gmail messages exchanged with the saved email address and automatically ticks "Válasz érkezett" the moment a reply from them shows up, no manual checkbox-hunting — general notes, a real **Email küldése** button, keresés, and CSV bulk import/export |
| **Feladatok** (Tasks) | Kanban board — Teendő / Folyamatban / Kész, drag & drop, priority, due date, assignee, keresés, CSV export. Overdue cards (past due date, not yet Kész) get a red border and a **Lejárt** badge so they stand out on the board itself, not just in the daily reminder email. Independent of the free-text kategória, every task also carries a **Típus** — Egyszeri (neutral gray) / Ismétlődő (🔁 blue) / Kampány (🎯 bronze, with a **clickable kampány name** shown right next to it, jumping to that kampány's részletes nézet on Marketing) — always visible as its own badge on the card. Picking Kampány on the "Feladat hozzáadása" form, a card's detail view, or "Sablonból hozzáadás" reveals a second dropdown, **"Melyik kampányhoz tartozik?"**, sourced from the real `campaigns` table (a "+ Új kampány" quick-add option in that dropdown creates one on the spot, everywhere except the batch Sablonból form). Set automatically where it can be — the recurring-template engine tags its own tasks Ismétlődő, "→ Feladat létrehozása" on a Marketing tartalom-naptár item inherits that item's kampány if it has one — and otherwise defaults to Egyszeri. A **Típus szűrő** narrows the board same as keresés, and a **Csoportosítás: Állapot szerint / Típus szerint** toggle above the board switches between the normal 3-status Kanban and an Egyszeri/Ismétlődő/Kampány view (every task regardless of status) — drag & drop in either view updates whichever dimension that view groups by. Click a card to open its full detail view (all fields + a free-form Megjegyzés/notes field, with Mentés/Mégse/Törlés buttons). **Sablonból hozzáadás**: pick any number of preset task templates (grouped by category, checkboxes) and add them all as Teendő tasks in one go; **Sablonok kezelése** (gear icon) is the full CRUD editor for those templates — create/edit/delete, with categories chosen from existing ones or typed fresh, plus an **Ismétlődő feladat** toggle (típus: Napi/Heti/Havi/Negyedéves/Éves, gyakoriság, első esedékesség) — a 🔁 badge and the next due date show right in the list. A recurring template whose due date has arrived or passed auto-generates its next Teendő task the moment Feladatok is opened (no cron — see `lib/recurring-templates.ts`), and rolls its own next_due_date forward on the same schedule; the seeded set already has 7 of them turned on (havi pénzügyi áttekintés, negyedéves fedezeti pont, éves AHV/Treuhand + domain ellenőrzés, heti Instagram/Feedback/Founder Wall). **Archiválás**: every Kész card gets an archive icon (next to Törlés) to take it off the board without deleting it — an "Összes archiválása" link in the Kész column header archives every Kész card currently shown there in one go (only offered on the Kész status column, not in Típus-grouped view, since a type column can mix statuses). Archived tasks live in a separate **Archívum** view (header button, shows a count) with a Visszaállítás button per row to bring one back, or a real Törlés if you're done with it for good |
| **Megrendelések** (Orders) | Customer orders — vevő, termék (free text, plus an optional **Kapcsolt termék** dropdown into the Termékek catalog so Pénzügyek can compute a real, COGS-aware árrés for that order, not just revenue), mennyiség, egységár + pénznem, szállítási határidő, státusz (Új → Feldolgozás alatt → Kiszállítva → Teljesítve), optional notes, **Email küldése**, keresés, CSV export |
| **Pénzügyek** (Finance) | **Tervezési kalkulátor**: reads price/COGS straight from the **Termékek** catalog (see below), read-only here — this page only asks for **tervezett darabszám** per product. **Tényleges bevétel**: from real Megrendelések egységár data, split into **Realizált** (Kiszállítva/Teljesítve) vs **Várható** (Új/Feldolgozás alatt), with a real árrés wherever an order has a Kapcsolt termék. **Havi trend**: a bevétel/önköltség/kiadás grafikon, last 6 months. **Fedezeti pont**: per-product break-even (havi fix költség ÷ egységnyi árrés), fed by the ismétlődő tételek in **Kiadások** below it — a full operating-cost log (megnevezés, kategória, összeg + pénznem, dátum, egyszeri vagy ismétlődő). Every mixed-currency sum on this page is converted with **live exchange rates** (see below), not just relabeled — the one exception is if that live-rate fetch itself fails, which degrades to the old unconverted-with-a-⚠-warning behavior rather than breaking the page. CSV export |
| **Marketing** | Four tabs. **Évszakos stratégia**: the original 4 fixed seasonal strategy cards (Tavasz/Nyár/Ősz/Tél, `marketing_campaigns` table) — editable theme & product focus, **Email küldése**, and, below that, its **Kampányok** — real named marketing pushes (`campaigns` table, e.g. "ZUSAMMEN FIRST 20") tagged with that season, each a clickable mini-card (name, státusz-jelvény, dátumtartomány), plus a **"+ Új kampány hozzáadása"** button that pre-fills the season. Clicking a kampány mini-card (or its badge anywhere else it appears — a Feladatok Kanban card's kampány-badge, a Tartalom-naptár item's 🎯-badge, jumping there via `/marketing?campaign=<id>`) opens its **részletes nézet**: alapadatok (leírás/dátumok/státusz, lightly editable), a status-grouped mini Kanban of every linked Feladat (Teendő/Folyamatban/Kész, each opening straight into Feladatok), and any linked Marketing tartalom + the Marketing anyagok (images) those content items point at. **Tartalom-naptár**: every scheduled post/story/email/campaign as a card (type + season + color-coded status badges, image preview, copy-text preview, and — when set — a clickable 🎯 kampány badge), nearest date first, with month/type/status filters and a "+ Új tartalom" form (title, type, optional season, optional kampány, date, copy text, status, and either an image upload **or** "Válassz a mentett anyagokból" — a gallery picker of already-uploaded Marketing anyagok, so the same image never gets uploaded twice); each card's **"→ Feladat létrehozása"** spins off a linked Kanban task (due date = the scheduled date, category "Marketing", inheriting the content item's kampány if it has one) — marking that task Kész automatically flips the content item's status to "Kiküldve". **Marketing anyagok**: an image library grouped by language (HU/EN/DE), each asset tagged with an optional platform and season, and a **kép-típus** — Koncepció / Valódi termékfotó / Lifestyle, shown as a loud color-coded badge (yellow/green/blue) directly on the thumbnail so a mockup is never mistaken for a real product photo (e.g. only "Valódi termékfotó" should ever go out on the webshop) — each asset's **"→ Tartalom létrehozása ebből"** opens the naptár form pre-filled with that image, so the chain Marketing anyag → Tartalom → Feladat stays fully linked without duplicating data at any level. **Email kampányok**: upload raw HTML email templates (an attached `.html` file or pasted straight in, editable/renameable in place) with an optional logo upload that auto-replaces every `YOUR_LOGO_URL` placeholder in the template — and, at preview/send time, every `{{first_name}}` (the recipient's name, or a capitalized guess from their email if none), `{{ritual_link}}` (the live `/together` Közös tér link, same `?code=` Beállítások generates), `{{privacy_link}}` (the existing `/landing/datenschutz` page), and `{{unsubscribe_link}}` placeholder is filled in automatically — the last one becomes [Brevo](https://brevo.com)'s own `{unsubscribe}` merge tag rather than a link this app builds, so Brevo enforces that suppression account-wide the moment it's clicked, no webhook needed to sync it back; each template card also has a **"Kampányhoz csatolás"** button that jumps straight to the send form below with that sablon preselected. A minimal **Hírlevél feliratkozók** list (name/email, add/delete) — this is exactly the list the "Hírlevél feliratkozók" checkbox below sends to. **"Email kampány küldése"**: pick a sablon, tárgy, and who it goes to (demand-test feliratkozók from the Igényfelmérés survey emails, hírlevél feliratkozók, or both) — **Előnézet** resolves the actual recipient list and shows the template filled in with a real subscriber's data (falling back to a labeled sample only if that list is empty), **Küldés** actually sends it through Brevo, personalized per recipient, and the sent campaign is logged on the Tartalom-naptár with status "Kiküldve". `BREVO_API_KEY` is a server-only Vercel environment variable (never written to Supabase, never exposed to the browser) — see [Set up Brevo](#2c-optional-email-campaigns-brevo) below |
| **Igényfelmérés** (Demand) | Live results from the `/landing` survey and Gold Card letters — bar charts for "would you buy?", price sensitivity and package-item popularity, plus lists of ideas and emails |
| **Dokumentumok** (Documents) | Simple document library with file upload to Supabase Storage, **Email küldése** (pre-filled with a link to the file), keresés |
| **Termékek** (Products) | The full product catalog — every card each grouped by státusz (Fejlesztés alatt / Tesztelés / Élő / Jövőbeli terv), with an optional photo, edition, and links to the **Kártya-verzió** (Kártya-fájlok) and **Beszállító** it's tied to. Click a card to expand it: linked kártya-verzió/beszállító (each a link to that page), COGS and eladási ár (each in its own stored currency — e.g. a USD-quoted COGS against a CHF sale price stays exactly that), and the computed **árrés** (absolute + %), **converted with live exchange rates** into your Beállítások → Pénznem preferencia — see Pénzügyek below for where those rates come from; a ⚠ only shows up if that live-rate fetch itself failed. Gold Card and anything else with a **gyártási megjegyzés** gets a loud yellow **"Külön gyártási folyamat"** badge so a different production process is never missed. **"+ Új termék hozzáadása"** picks the kártya-verzió/beszállító from existing records via dropdowns. The **Pénzügyek** calculator reads this table directly — see below |
| **Kártya-fájlok** (Card assets) | Versioned print-ready card files, grouped by language (HU/DE/EN) — upload a ZIP, a single Word/ODF/CSV file, or an entire folder (zipped in the browser on the fly, subfolders included) with a version label, nyomtatási állapot, optional beszállító/rendelés dátuma/mennyiség and notes. On upload, the server unzips it and pulls out up to 4 preview thumbnails by filename (front/back/wild/goldcard) shown in a small grid on each version. Click a version to open its full detail (untruncated notes, download, delete) and optionally spin a **Feladat** off of it — the new task shows up on the Feladatok board like any other. Each version also has an expandable **Árajánlatok** section — an "+ Új árajánlat hozzáadása" form (beszállító legördülő, mennyiség, egységár + pénznem, kép feltöltése, megjegyzés, dátum) and a list of every price quote received for that version, with a star toggle to mark the accepted one (highlighted green); quotes and suppliers are linked both ways, so the same registry shows up on the supplier's profile too. The most recent upload per language is flagged **Legújabb** |
| **Személyes rituálé** (Personal Ritual) | Three private rituals for the founders themselves, not the business. **Gold Card Letters**: a hero countdown ("X nap a következő levélig", first round 2026.09.01 then every 3 months) with 4 seal icons that fill up as letters are sealed, an always-visible rituálé-útmutató panel with the 3 fixed prompt questions, and an upload form (ki tölti fel, dátum, fotó) — every sealed letter's photo shows blurred and darkened with a seal icon and "Lepecsételve" overlay, never the actual contents. **Személyes Journey (Passport)**: a free-form emlék-napló (hely, élmény, jegyzet, optional fotó) as a timeline, a fixed 5-card Wild Card grid (Coffee Break / Silence / Memory / Adventure / Gratitude) each checkable off with a date, and a progress bar ("X/5 Wild Card teljesítve" + memory count). At the top of the emlék-napló, an **"Ezen a napon" visszatekintés** card quietly surfaces whenever a memory landed exactly egy hónapja or egy éve (±1 nap) — click it to scroll straight to (and briefly highlight) that entry. The moment all 5 Wild Cards are complete, a warm gold **Évszak-zárás** card appears once ("üljetek le pár percre, és beszéljétek meg…") and stays up until dismissed with "Elolvastam" (remembered per-browser, same as the Naptár legend toggles — there's no "next round" to reset it for since completions can't currently be undone). An **"Emlékeink nyomtatása"** button turns every emlék-napló entry (dátum, hely, szöveg, fotó) into a Fraunces-titled, meleg elefántcsont-hátterű keepsake via the browser's print dialog (save as PDF) — same `window.print()` + hidden `.print-*` convention as the `/landing` letter keepsake. **Meglepetés kérdés**: "Húzz egy lapot" shuffles through a 58-question Hungarian pool for ~1.5s before landing on one, framed by a random intro/outro (every outro explicitly mentions putting the phone down) and a fixed reminder that the phone is only for sending the message — "Másolás küldéshez" copies the full text ready to send. Every letter, memory, Wild Card completion, and question draw shows up in the Áttekintés activity feed |
| **Postaláda** (Inbox) | Read-only view of the connected Gmail account's inbox (needs the `gmail.readonly` scope — see the reconnect note below) — sender, subject, snippet, and relative time per row, a Gmail-syntax search box (e.g. `from:supplier@example.com`), "Továbbiak betöltése" pagination, and clicking a row opens the full message body. No mark-as-read/archive/delete actions by design, just viewing |
| **Megosztások** (Shares) | **Megosztható link és QR kód**: the live `/landing` URL (DE/EN toggle) with a "Link másolása" button, a self-generated QR code (`/api/qr`, no third-party service) with a "QR kód letöltése" PNG download, and — where the browser supports it — a native "Megosztás" share-sheet button. Shows even before Supabase is configured, since it needs neither. **Kapcsolatok**: a sajtó/influencer/ismerős contact list (name, email, kategória, jegyzet), each with its own **Email küldése** — a successful send auto-fills "Kiküldött email" and ticks "Megkeresve", same as Beszállítók — and a **Levelezés** toggle per card previews the Gmail thread with that contact and auto-ticks "Megkeresve" the moment they reply, same mechanism as Beszállítók. **Demand-test link megosztásai**: a log of every time the `/landing` igényfelmérés link was emailed out — "+ Új megosztás" picks an existing kapcsolat or a one-off name/email, opens the compose window pre-filled with the link, and a successful send adds a row to the log |
| **Beállítások** (Settings) | **Gmail összekapcsolása** — connects the Google account every "Email küldése" button sends through when `EMAIL_PROVIDER=gmail` (the default), and that Postaláda reads from; shows the connected address, and a **Kapcsolat bontása** button. See [Set up email sending](#2-set-up-email-sending-gmail-default) below. **Közös tér linkje** — generates/regenerates the access code for the partner-shared `/together` page and shows the full link to send. See [`/together`](#together--shareable-partner-page) below. **Márka-adatok** — company name/address/phone/email + a logo upload. **Email-aláírás** — free text automatically appended to every email sent through an "Email küldése" button (default: "Zusammen — Where conversations become memories."). **Naptár-integráció** — shows whether the negyedéves Gold Card Letters due-date reminder is active on Naptár/Áttekintés, with Szüneteltetés/Aktiválás and a Újra beállítás button (sealed letters already on record always keep showing). **Pénznem preferencia** — CHF/USD/EUR, changes how prices are *displayed* on Pénzügyek (there's no exchange-rate source, so it relabels the stored number rather than converting it). **Naptár feliratkozás** — generates a `.ics` subscription link (own token, not the dashboard's Basic Auth — see below) so every Naptár event shows up with native reminders in Google Calendar/Apple Naptár/your phone. **Adatexport** — one button downloads every Supabase table as a CSV, zipped. **Veszélyes zóna** — "Minden adat törlése" wipes all founder-entered business/content data (type TÖRLÉS to confirm) but keeps the Gmail connection, the Közös tér code, and Márka-adatok intact. **Fiók** — shows the logged-in Supabase Auth email and a **Kijelentkezés** button — see [Set up your login](#set-up-your-login-supabase-auth) below |
| **Jövőbeli tervek** (Future Plans) | Idea backlog — Ötlet / Fontolgatva / Tervezve |

**Navigáció**: the sidebar (`components/Nav.tsx`) groups everything but
Áttekintés into 4 labeled sections — **üzlet** (Beszállítók, Megrendelések,
Pénzügyek, Igényfelmérés), **tartalom** (Kártya-fájlok, Marketing,
Dokumentumok), **munkafolyamat** (Feladatok, Naptár, Jövőbeli tervek),
**kapcsolat** (Postaláda, Megosztások) — with **Személyes rituálé** set
visually apart below them (a warm bronze background + left border even
while inactive, since it's a private ritual, not a business function) and
**Beállítások** alone at the bottom, each behind its own divider.
`lib/nav-items.ts` is the single list both the sidebar and the **Cmd+K /
Ctrl+K** quick-switcher (`components/CommandPalette.tsx`, built on
[`cmdk`](https://cmdk.paco.me/)) read from, so the two can't drift apart —
type to filter, Enter to jump straight to any page (there's also a
"Gyorskeresés…" button at the top of the sidebar for anyone who doesn't
know the shortcut). Collapses behind the usual hamburger menu on mobile.

Every delete action (Beszállítók, Feladatok, Pénzügyek, Dokumentumok,
Jövőbeli tervek, Megrendelések) removes the row immediately and shows a
**Visszavonás** (undo) toast for a few seconds before it's actually deleted
from Supabase — nothing is lost to a stray click.

**Email küldése** (Beszállítók, Megrendelések, Dokumentumok, Marketing,
Megosztások): a real send button — opens a small compose window (to /
subject / message), and Küldés actually sends it through whichever
provider `EMAIL_PROVIDER` selects — **Gmail by default** (as
`zusammen.swiss@gmail.com`, via OAuth), or [Resend](https://resend.com)
if set to `resend`. On Beszállítók and Megosztások kapcsolatok
specifically, a successful send also auto-fills the existing "Kiküldött
email" field with what was sent and ticks "Megkeresve". See [Set up
email sending](#2-set-up-email-sending-gmail-default) below; without a
connected Gmail account (or a Resend key, if using that instead) the
send button shows a clear "Gmail nincs összekapcsolva — kattints ide az
engedélyezéshez" (or the equivalent Resend error) instead of failing
silently.

**CSV import for Suppliers**: the "Beszállítók importálása CSV-ből"
button reads a CSV with these columns (a "Minta CSV letöltése" link next
to the search box downloads a ready-made example with this exact header):

```
name,category,country,website,email,phone,whatsapp,products,notes
```

Only `name` is required — every other column can be blank. `products` is
a single cell with multiple products separated by `;` (e.g.
`"Kártya 90x60mm; Doboz; Matrica"`), imported as rows with just the name
filled in — price/MOQ/note can be added afterward from the supplier's
profile. Every row becomes one new supplier; this is import-only (it
doesn't match against or update existing suppliers), so re-importing the
same file creates duplicates.

**CSV export** (Beszállítók, Megrendelések, Feladatok): an "Exportálás
CSV-be" button next to each list downloads everything currently in that
table as a `.csv` file (UTF-8, Excel-friendly) — handy for backups or
handing a list to someone outside the dashboard.

**Napi emlékeztető email**: once a day (06:00 UTC by default, see
`vercel.json`), the app emails a summary of what needs attention —
overdue/soon-due Feladatok, overdue/soon Megrendelés deliveries, and
Beszállító contracts expiring within 14 days — to
`zusammen.swiss@gmail.com` (or `REMINDER_EMAIL_TO` if you set one). This
runs as a [Vercel Cron Job](https://vercel.com/docs/cron-jobs) calling
`/api/reminder-email`; see [Set up the reminder
email](#3-set-up-the-daily-reminder-email-optional) below — it needs one
more environment variable (`CRON_SECRET`) beyond the email setup above.

**Értesítési központ**: a bell icon in the nav (top-right of the mobile
header, top of the desktop sidebar) with a badge showing how many things
need attention — the exact same overdue/soon-due Feladatok, Megrendelés
deliveries, and lejáró Beszállító contracts as the daily reminder email
above (`lib/notifications.ts` is the single source of truth both share),
plus the unread Gmail count. Click it for the list, each row links
straight to the relevant page. No setup needed — it just reads whatever
Supabase already has and, if Gmail is connected, the unread count;
either piece missing just means less shows up, not an error.

**Képek és dokumentumok megnyitása**: every uploaded photo across the app
(Dokumentumok, Kártya-fájlok — both the list thumbnails and the version
detail's preview grid, Marketing anyagok and Tartalom-naptár képek, a
kampány részletes nézet levezetett anyagai, árajánlat-képek, Journey
emlékek, Termékek képei) opens in a full-size **Lightbox** on click
(`components/Lightbox.tsx`) — a darkened overlay, closable via the X
button, clicking the backdrop, or Escape — instead of just downloading
the raw file. A non-image file (a Kártya-fájlok ZIP/Word/ODF bundle, a
non-image Dokumentum) still opens via the browser: a PDF opens straight
into its own in-tab viewer, labeled **"Megnyitás"**; anything else is
labeled **"Megnyitás (letöltés szükséges)"** so it's clear upfront that a
download — not a preview — is what's about to happen
(`lib/file-open.ts`). The one deliberate exception is the Gold Card
Letters envelope photo, which stays exactly as blurred/sealed as before —
it's never meant to be viewable full-size from the dashboard, lightbox
included.

**"← Vissza"**: every detail/expanded sub-view (egy kampány részletes
nézete, egy feladat/kártya-fájl/beszállító részletes nézete, egy kibontott
termékkártya) shows a labeled `components/BackButton.tsx` at the top —
never just a small arrow icon — alongside whatever close/collapse control
it already had, so it reads clearly and stays easy to tap on mobile.

**Összecsukható listák (accordion)**: every longer list or preview in the
Dashboard shares one `components/CollapsibleSection.tsx` — same ▸/▾
chevron, same ~200ms animated open/close (a grid-rows transition that
measures the content's own height, same technique the mobile nav drawer
uses). It's behind the sidebar nav's **Üzlet/Tartalom/Munkafolyamat/Kapcsolat**
group headers (click to collapse/expand, remembered per-browser — a group
holding the current page always shows itself regardless of what was
remembered), the **Email-sablonok** "szem" ikon (starts collapsed, only
that template's preview animates open), **Hírlevél feliratkozók**,
**Beszállítók** and **Dokumentumok** each grouped by kategória, **Termékek**
grouped by státusz, **Kártya-fájlok** and **Marketing anyagok** grouped by
nyelv, and a season's **Kampányok** list on Marketing. Wherever a group can
run long (more than 8 items), `lib/useShowMore.ts` + `components/ShowMoreButton.tsx`
show only the first 8 with a "+N továbbiak megjelenítése" link — click again
to collapse back down.

## `/landing` — public customer-facing page

A separate, standalone page (no dashboard chrome, no Basic Auth lock even
if you enable one — see below) at `/landing`, linked from the dashboard
sidebar. It's an interactive funnel — founder story, a sample card demo,
a "gold card" letter prompt, a package builder, a short survey — with a
DE/EN language toggle in the top corner. Survey responses and letters are
saved to Supabase (`landing_responses`, `landing_letters`); a small
password-gated "founder view" (bottom-right link) shows aggregate stats
pulled from those tables — the password defaults to `zusammen2026`, set
`NEXT_PUBLIC_LANDING_FOUNDER_PASSWORD` (see `.env.example`) to change it
without putting the real value in git.

**Navigation**: a back/home/forward pill (top-left, mirroring the DE/EN
switch on the top-right) lets visitors move both directions through the
funnel — browser-style: back and forward step through everywhere you've
actually been, home jumps straight to the hero from any screen. Nothing
already typed is lost by stepping away and back — the gold-card letter
text and the survey answers live one level up from their screens
specifically so back/forward doesn't wipe them — and re-submitting after
navigating back doesn't create duplicate Supabase rows (a submit is
skipped if the content already matches what was last saved).

**Tactile touches** (built with [Framer Motion](https://www.framer.com/motion/)):
the hero's logo is a physical-feeling card you can drag around (springs
back within its bounds) and tap/flip to preview a real question from the
deck — desktop adds a mouse-follow 3D tilt on top, gated behind a
`(hover: hover) and (pointer: fine)` check so touch devices just get
drag + tap instead (verified equally responsive on iPad/iPhone, portrait
and landscape). The brand mark (mountain + heart) draws itself in with an
animated stroke the moment it scrolls into view, rather than eagerly on
load. The demo deck shows 1-2 fanned, rotated card-backs behind the
active card — a "hand-held pack" that visibly thins out as you draw. The
whole page has a barely-there paper-grain texture instead of flat color
fields. All of this respects `prefers-reduced-motion` (skips the tilt and
draw-in, keeps the essential state changes) and degrades to nothing (a
static logo, no tilt) if JavaScript hiccups.

**Sound** (`lib/landing-sound.ts`): a soft, synthesized tap/flip sound
plays on the card interactions above — off by default, with a mute/unmute
toggle next to the DE/EN switch (persisted per-browser via
`localStorage`). Every sound is generated on the fly with the Web Audio
API (filtered noise bursts, no external audio file), so it's
dependency-free — swap `playNoiseBurst` in that file for real recorded
clips later if you'd rather use those.

A matching pair of standalone legal pages ships alongside the funnel,
linked from a small footer bottom-left: `/landing/impressum` and
`/landing/datenschutz` (German-only, as is standard for DE/CH sites).
Every value only the founder can know (business name/address, contact
email, Supabase hosting region, …) is a highlighted "BITTE AUSFÜLLEN"
placeholder in the page itself — **fill these in before sharing the
`/landing` link publicly**, since the funnel collects an optional email
address and Swiss/EU sites need a real Impressum + Datenschutzerklärung.

**Social previews** (`og:*` / `twitter:*` tags, so the link looks right
when pasted into WhatsApp, iMessage, Slack, etc.): defined in
`app/landing/page.tsx`'s `generateMetadata`, sourced from
`lib/landing-og.ts`. The preview image itself is generated on request —
not a static file — by `app/api/og/route.tsx`, a branded placeholder
(dark-forest gradient, gold mountain+heart mark, the tagline in Fraunces)
built with Next's `ImageResponse`; swap that route for real product
photography whenever it exists by pointing the `openGraph`/`twitter`
`images` URLs in `generateMetadata` at actual files instead. Title and
image are the same across languages; the description and `og:locale` vary
by `?lang=de|en|hu` — bare `/landing` (no query string) is the German
default, matching the page's own default language. Since `/landing`
itself only has German/English on-page copy (see `lib/landing-i18n.ts`),
`?lang=hu` only changes the *social preview* text, not the page you land
on — it still opens in German. Use whichever `/landing?lang=…` link
matches the audience you're sharing it with, so both the on-page content
and the preview card match.

### Before you share the `/landing` link

1. **Personalize the founder story** — `lib/landing-i18n.ts` has a
   `// TODO before launch` comment above the `story` block in both the
   `de` and `en` sections; it reads fine as-is, but swap in your own
   real story if you have one.
2. **Set a real founder-view password** — `NEXT_PUBLIC_LANDING_FOUNDER_PASSWORD`
   env var, see above.
3. **Fill in the legal pages** — open `/landing/impressum` and
   `/landing/datenschutz` (or their source under `app/landing/`) and
   replace every "BITTE AUSFÜLLEN" placeholder with your real details.
4. **Set `SITE_URL`** to your real production domain once you have one
   (see the env var comment in `.env.example`) — without it, the social
   preview image/canonical URLs point at the default Vercel preview
   domain, which won't match wherever you actually deploy.

## `/together` — shareable partner page

A separate, standalone page (no dashboard chrome, no login) at
`/together`, reached only through a 6-character access code — not part
of the founder Dashboard's own navigation, and not linked from it either.
Generate the code and the full link from the Dashboard's **Beállítások →
Közös tér linkje** ("Link generálása" the first time, "Új kód
generálása" any time after — regenerating invalidates the old link for
anyone still using it).

**Access model**: the code is a soft UX gate, not a hard security
boundary — same as everything else in this app except `gmail_connection`
(see the comment on `together_settings` in `supabase/schema.sql`). Anyone
opening the link (`…/together?code=XXXXXX`) is verified against
`together_settings.access_code`; on success the code is remembered in
that browser's `localStorage` so it isn't asked again. First time in,
it also asks **"Ki vagy?"** (a quick "Barbara" button or a free-text name
for anyone else) and remembers that too — every Gold Card letter, journey
memory, or Wild Card completion added from `/together` after that is
tagged with that name automatically (the `added_by` column added to
`gold_card_letters`, `journey_memories`, `wild_card_completions`), no
manual "who's uploading this" field to fill in.

**What's on it**: a hero — "A mi utunk a Café to Connect megnyitójáig" —
with an opening-date field either person can set or change right there
(symbolic "A dátum még nincs kitűzve — de az út már elkezdődött." copy
when it's empty); once set, a daily countdown plus the same 4-seal Gold
Card progress indicator used elsewhere. Below that, the exact same three
Személyes rituálé sections as the founder Dashboard's own
**Személyes rituálé** page — Gold Card Letters, Journey/Passport
(memories + Wild Card grid), Meglepetés kérdés — reading and writing the
same shared Supabase tables, since there was never a per-user split to
begin with.

---

## 1. Set up Supabase (free tier)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any
   name/region and a database password (save it somewhere safe — you
   won't need it for this app, but Supabase asks for it).
2. Once the project is ready, open **SQL Editor** in the left sidebar →
   **New query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo,
   copy its entire contents, paste into the SQL editor, and click **Run**.
   This creates all the tables (including `email_templates`,
   `newsletter_subscribers`, and `email_unsubscribes` for the Marketing →
   Email kampányok tab, and `expenses` for Pénzügyek → Kiadások), seeds
   the 4 marketing seasons and the starter **Termékek** catalog, sets up
   Row Level Security, and creates the `documents`, `card-assets`,
   `price-quotes`, `marketing`, `gold-card-letters`,
   `journey-memories`, `company-logo`, `product-images`, and
   `email-assets` Storage buckets used for file uploads.
   Safe to re-run any time you pull schema changes — every statement is guarded so it
   won't fail or duplicate data on a second run.
4. Go to **Project Settings → API**. You'll need two values from here:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

That's it — the database, tables, and file storage are ready.

> **Note on currency conversion:** Pénzügyek/Termékek/Áttekintés convert
> mixed-currency amounts (a USD-quoted COGS against a CHF sale price,
> say) using live rates from [Frankfurter](https://www.frankfurter.dev/)
> (ECB reference rates) — free, no API key or signup needed, nothing to
> configure. If that request ever fails (an outage, or this app running
> somewhere without outbound internet access), those pages fall back to
> the old unconverted-with-a-⚠-warning behavior rather than breaking.

> **Note on security:** this app talks to Supabase with the public
> "anon" key directly from the browser, which is normal for a
> single-user tool like this. Row Level Security is enabled with
> permissive policies so the anon key can read/write your tables. The
> real protection is the login below — every dashboard page requires an
> authenticated Supabase Auth session, redirecting to `/login`
> otherwise — plus, optionally, the network-level Basic Auth lock
> further down.

### Set up your login (Supabase Auth)

`/login` (email + jelszó, Supabase Auth) is the dashboard's real login
gate — `proxy.ts` redirects every other dashboard page here unless the
browser has a valid Supabase Auth session, and back to `/` if you're
already logged in and open `/login` directly. There's no self-service
sign-up screen — accounts are created by hand in the Supabase dashboard:

1. In your Supabase project, open **Authentication → Users → Add user**
   (top-right).
2. Enter the email you want to log in with, set a password, and toggle
   **Auto Confirm User** on (otherwise Supabase waits for an email
   confirmation link that this app never sends).
3. That's it — that email/password now logs in at `/login`. Repeat for
   any other founder/team member who needs access; there's no limit and
   no extra setup per account.

Forgot a password? Same screen — open the user, **Reset password**, or
delete and re-add them. **Beállítások → Fiók** shows who's currently
logged in and has the **Kijelentkezés** button.

### Optional: also lock the whole dashboard at the network level

On top of the Supabase Auth login above, the app ships with a simple
Basic Auth check (`proxy.ts`) for an extra layer before any of it is
even reachable: set **both** `DASHBOARD_USER` and `DASHBOARD_PASSWORD`
as environment variables and every dashboard page will ask for a
username/password in the browser before loading — including `/login`
itself. Leave them unset to skip this extra layer (the Supabase Auth
login still applies either way).

- **Locally**: add both to `.env.local`.
- **On Vercel**: Project → Settings → Environment Variables (same place
  as the Supabase keys — see the deploy step below), then **redeploy**
  — Vercel only picks up new/changed environment variables on the next
  deployment, not on already-running ones.
- `/landing`, `/api/reminder-email` (the daily cron summary),
  `/api/calendar/ics` (the Naptár subscription feed — see Beállítások →
  "Naptár feliratkozás"), and `/api/newsletter/unsubscribe` (the
  leiratkozás link at the bottom of every campaign email) are always
  excluded, so the public funnel, the reminder email, your calendar app,
  and anyone unsubscribing from a campaign all keep working even with
  the lock on. The `.ics` feed has its own gate instead (a `?token=`
  checked against a value generated on Beállítások) since calendar apps
  generally can't supply Basic Auth credentials when polling a
  subscription URL.

---

## 2. Set up email sending (Gmail, default)

The **Email küldése** buttons (Beszállítók, Megrendelések, Dokumentumok,
Marketing, Megosztások) send real emails. Every one of them goes through
the same `/api/send-email` route, which hands off to whichever transport
`EMAIL_PROVIDER` selects (`lib/email/index.ts`) — **Gmail by default**,
sending as `zusammen.swiss@gmail.com` through the real Gmail account
(via OAuth, not an API key), so recipients see mail actually coming from
that address instead of a third-party sending domain. [Resend](#2b-alternative-resend)
is kept ready behind the same interface for later, once a verified
custom domain exists — see that section for when/why you'd switch.

### Beállítások → "Gmail összekapcsolása"

Sending only works once the founder connects their Gmail account from
the dashboard itself (**Beállítások** in the nav → **Gmail
összekapcsolása**) — until then, every send attempt shows "Gmail nincs
összekapcsolva — kattints ide az engedélyezéshez" instead of a generic
error. Before that button works, though, this app needs its own Google
OAuth client — that part happens in Google Cloud Console, one time:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) →
   create a new project (or reuse one) — any name works, e.g. "Zusammen
   Dashboard".
2. **APIs & Services → Library** → search "Gmail API" → **Enable**.
3. In the left sidebar, open **Google Auth Platform** (Google's newer
   consolidated OAuth setup screen — this replaced the older separate
   "OAuth consent screen" page; same idea, different name/layout):
   - **Branding**: fill in **App name** and **User support email**
     (`zusammen.swiss@gmail.com`), and scroll to **Developer contact
     information** and add an email there too. The **App domain** fields
     (homepage/privacy policy/terms of service links) can stay empty —
     they're only required for Google's public verification, which this
     single-user app never goes through. Save.
   - **Audience**: **User type** should be **External** (a personal
     Gmail account, not Google Workspace, can't use Internal). Scroll to
     **Test users** → **+ Add users** → add `zusammen.swiss@gmail.com`
     (and any other account you might connect). Leaving **Publishing
     status** as **Testing** is fine and expected — it's a single-user
     tool, and Testing mode never expires the way a verified production
     listing would need ongoing review for. **Only accounts listed here
     can ever complete the OAuth flow** — this is the single most common
     thing to miss, and shows up as a 403 "access_denied" error if
     skipped.
   - **Clients**: **+ Create client** → Application type **Web
     application** → give it a name → under **Authorized redirect
     URIs**, add both, so it works locally and in production:
     - `http://localhost:3000/api/auth/gmail/callback`
     - `https://YOUR-PRODUCTION-DOMAIN/api/auth/gmail/callback` (use
       whatever `SITE_URL` is set to — see below; if there's no custom
       domain yet, the Vercel URL works, e.g.
       `https://zusammen-dashboard.vercel.app/api/auth/gmail/callback`)
     - **Create** → a dialog shows the **Client ID** and **Client
       secret** — copy both **now** (with the copy-icon buttons, not by
       selecting text by hand — easy to lose a character that way,
       which shows up later as a confusing "invalid_client" error). The
       secret is shown only this once.
4. Add four environment variables (locally in `.env.local`, on Vercel
   under Project → Settings → Environment Variables):
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from step 3.
   - `TOKEN_ENCRYPTION_KEY` — a fresh 32-byte key, e.g. run
     `openssl rand -hex 32`. Encrypts the Gmail refresh token before it's
     stored in Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project's
     **Project Settings → API → service_role** (a different, more
     powerful key than the anon one used everywhere else in this app —
     never expose it as a `NEXT_PUBLIC_` variable). Needed so the server
     can read/write the `gmail_connection` table, which deliberately has
     no anon-key policy (see `supabase/schema.sql`) since it holds an
     encrypted token that grants send-as and inbox-read access.
   - **Redeploy** after saving these on Vercel — it only picks up new
     env vars on the next deployment.
5. Open the dashboard → **Beállítások** → **Gmail összekapcsolása** →
   sign in with `zusammen.swiss@gmail.com` → approve the requested
   permissions. Sending (and Postaláda, see below) works immediately
   after that.

> **Reconnecting.** If Gmail access is ever revoked (from Google Account
> settings, or simply expires), the next send attempt shows the same
> "Gmail nincs összekapcsolva" prompt — click it, sign in again, done.
> **Kapcsolat bontása** on Beállítások disconnects manually any time.
>
> **Postaláda (inbox) needs a reconnect if you connected before it
> existed.** Sending uses the `gmail.send` scope; the **Postaláda** page
> additionally needs `gmail.readonly`. A connection made before that
> scope was added to the app only has `gmail.send`, so Postaláda will
> show "Gmail nincs összekapcsolva" until you **Kapcsolat bontása** and
> reconnect once — Google requires fresh consent for a newly-added
> scope, it's not picked up automatically.

### 2b. Alternative: Resend

[Resend](https://resend.com) is a free-tier-friendly email API, kept
behind the same `EmailSender` interface (`lib/email/resend-sender.ts`) —
useful once a real custom domain exists (Resend can't send "from"
`zusammen.swiss@gmail.com` any more than Gmail's API could send from a
domain you don't own the other way around) or if Gmail OAuth ever feels
like more setup than it's worth for a given deployment.

To switch: set `EMAIL_PROVIDER=resend`, then:

1. Go to [resend.com](https://resend.com) → **Sign up** (free — 3,000
   emails/month, 100/day is plenty for this).
2. In the Resend dashboard, open **API Keys** → **Create API Key**. Give
   it any name (e.g. "Zusammen dashboard"), leave permissions as
   "Full access", and copy the key — it starts with `re_` and is only
   shown once.
3. Add it as an environment variable named `RESEND_API_KEY`.

That's it — sending works immediately using Resend's shared
`onboarding@resend.dev` sender, with replies routed to
`zusammen.swiss@gmail.com`. Once you have a verified domain, set
`RESEND_FROM_EMAIL` (e.g. `Zusammen <hello@zusammenswiss.ch>`) and
optionally `RESEND_REPLY_TO` — no code changes needed either way.

> **Note:** the daily reminder email (next section) always sends via
> Resend directly, regardless of `EMAIL_PROVIDER` — it's an unattended
> Vercel Cron job with no one to click through a "Gmail nincs
> összekapcsolva" prompt if the OAuth connection ever lapses, so it
> intentionally doesn't depend on it. It needs `RESEND_API_KEY` set
> either way if you want that email.

---

### 2c. Optional: Email campaigns (Brevo)

Powers the **Marketing → Email kampányok** tab — bulk, personalized HTML
campaigns to your demand-test and hírlevél feliratkozók, independent of
`EMAIL_PROVIDER` above (that setting is for the single-recipient "Email
küldése" buttons app-wide; this is a different, bulk-sending feature with
its own transport, `lib/brevo.ts`). Leave it unset and the campaign form
simply shows "Brevo nincs beállítva" — Előnézet still works, nothing else
on the dashboard is affected.

1. Go to [brevo.com](https://brevo.com) → **Sign up** (free — 300
   emails/day, plenty for a founder-sized list).
2. In the Brevo dashboard, open **Settings → SMTP & API → API Keys** →
   **Generate a new API key**. Give it any name and copy it.
3. Add it as an environment variable named `BREVO_API_KEY`.
4. Optionally set `BREVO_FROM_EMAIL` / `BREVO_FROM_NAME` — both default
   to `zusammen.swiss@gmail.com` / `Zusammen` if unset. Note the sending
   address needs to be a domain/sender Brevo lets you send from (see
   their dashboard) — free accounts can usually verify a single sender
   email without owning the whole domain.

Templates are raw HTML you upload on the Email kampányok tab. Every
placeholder below is filled in automatically, both on **Előnézet** and on
the real send (`lib/email-campaign.ts` is the single source both use, so
the two can never drift apart):

| Placeholder | Filled with |
|---|---|
| `{{first_name}}` | the recipient's name (hírlevél feliratkozók), or a capitalized guess from their email address if none is on file |
| `{{ritual_link}}` | the live `/together` (Közös tér) link — same `?code=` format as Beállítások → "Közös tér linkje" |
| `{{privacy_link}}` | the existing public `/landing/datenschutz` page |
| `{{unsubscribe_link}}` (or the older `{{unsubscribe_url}}`) | Brevo's own `{unsubscribe}` merge tag — **not** a link this app builds. Brevo swaps it for a real, working link at send time and enforces that suppression account-wide (transactional and campaign sends alike) the instant it's clicked — no webhook needed to sync it back into Supabase |

If a template has no unsubscribe placeholder at all, a footer line with
Brevo's tag is appended automatically so every campaign stays
unsubscribable regardless of what was uploaded.
`/api/newsletter/unsubscribe` still exists as a manual/admin fallback
(e.g. marking someone unsubscribed by hand) and is excluded from the
optional Basic Auth lock (see above) since it's meant to be clicked from
an inbox, not the dashboard — but campaign emails themselves no longer
link to it.

---

## 3. Set up the daily reminder email (optional)

This uses `RESEND_API_KEY` from [section 2b](#2b-alternative-resend)
above to send one summary email a day — set that up first even if
you're using Gmail as `EMAIL_PROVIDER` for everything else (see the note
at the end of section 2 for why the reminder email doesn't use Gmail).
Skip this whole section if you don't want the reminder; the rest of the
app works fine without it.

If Gmail is connected with the `gmail.readonly` scope (see section 2),
the reminder also adds an "X olvasatlan levél a Postaládában" line —
purely best-effort, a disconnected/lapsed Gmail connection just silently
omits that one line rather than failing the whole email.

1. Pick any long random string as a shared secret — e.g. run
   `openssl rand -hex 32` in a terminal, or just mash the keyboard for 30+
   characters. This is **not** a password you need to remember, only a
   value both Vercel and this app know.
2. Add it as an environment variable named `CRON_SECRET` (locally in
   `.env.local`, and on Vercel — same place as the other keys, see the
   deploy step below). Vercel automatically sends this as a
   `Authorization: Bearer …` header when it triggers your cron job, and
   `app/api/reminder-email/route.ts` checks for it — without it, the
   route refuses every request (including Vercel's own), so the emails
   just won't go out until it's set.
3. That's it — `vercel.json` already defines the schedule (06:00 UTC
   daily; edit the cron expression there to change it). Vercel picks it
   up automatically on your next deploy, no dashboard clicking required.
4. Optional: set `REMINDER_EMAIL_TO` if the summary should go somewhere
   other than `zusammen.swiss@gmail.com`.

To test it manually before waiting for the schedule:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-deployment.vercel.app/api/reminder-email
```

> **Vercel plan note:** cron jobs are available on Vercel's Hobby (free)
> plan, but limited to once a day per job — which is exactly what this
> uses. If your project is on a different plan with different limits,
> adjust `vercel.json` accordingly.

---

## 4. Run it locally (optional)

```bash
npm install
cp .env.example .env.local
# edit .env.local: paste in your Supabase URL + anon key, and your Resend API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 5. Deploy to Vercel (get a real URL)

1. Push this repo to GitHub (already done if you're reading this from
   your repo).
2. Go to [vercel.com/new](https://vercel.com/new) and sign in with
   GitHub.
3. Click **Import** next to this repository.
4. Vercel auto-detects Next.js — leave the build settings as default.
5. Before deploying, open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key |
   | `RESEND_API_KEY` | your Resend API key (needed for the Email küldése buttons) |
   | `CRON_SECRET` *(optional)* | needed only for the daily reminder email — see step 3 |
   | `BREVO_API_KEY` *(optional)* | needed only for Marketing → Email kampányok — see step 2c |
   | `DASHBOARD_USER` *(optional)* | a username, to lock the dashboard |
   | `DASHBOARD_PASSWORD` *(optional)* | a password, to lock the dashboard |
   | `RESEND_FROM_EMAIL` *(optional)* | only once you've verified your own domain in Resend |
   | `RESEND_REPLY_TO` *(optional)* | only if replies shouldn't go to zusammen.swiss@gmail.com |
   | `REMINDER_EMAIL_TO` *(optional)* | only if the daily reminder shouldn't go to zusammen.swiss@gmail.com |
6. Click **Deploy**. In about a minute you'll get a live URL like
   `https://zusammen-dashboard.vercel.app`.

Every time you push to your main branch, Vercel redeploys automatically.

---

## Project structure

```
app/                     Next.js App Router pages (one folder per tab)
app/api/send-email/      Server-side route that calls Resend (holds RESEND_API_KEY)
app/api/reminder-email/  Daily cron route — due-soon summary via Resend (holds CRON_SECRET)
app/api/og/              Generates the /landing social-preview image (?lang=de|en|hu)
app/landing/page.tsx     Server wrapper: generateMetadata (og:/twitter: tags) + initial lang
app/landing/LandingClient.tsx  The actual interactive funnel (moved out so page.tsx can be a Server Component)
app/landing/impressum/   Standalone legal notice for /landing — fill in before launch
app/landing/datenschutz/ Standalone privacy notice for /landing — fill in before launch
components/              Shared UI (nav, cards, empty states, feedback)
lib/supabase/client.ts   Browser Supabase client
lib/supabase/types.ts    Hand-written types matching supabase/schema.sql
lib/landing-og.ts        Per-language og:/twitter: title/description copy
lib/site-url.ts          Base URL for metadataBase + the OG image route (SITE_URL env var)
lib/format.ts            Currency/date formatting helpers
lib/csv.ts               CSV export helper (used by Suppliers/Orders/Tasks)
supabase/schema.sql      Full database schema — run once in Supabase
vercel.json              Cron schedule for the reminder email
proxy.ts                 Optional Basic Auth lock
```

## Customizing

- **Brand colors & fonts** live in `app/globals.css` (`:root` custom
  properties) — Forest Green, Warm Ivory, Bronze Gold, Walnut Brown, plus
  the Fraunces (serif headings) / Inter (sans body) font pairing from
  `app/layout.tsx`.
- **Schema changes**: edit `supabase/schema.sql`, re-run the relevant
  parts in the Supabase SQL editor, then update
  `lib/supabase/types.ts` to match.
