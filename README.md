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
| **Áttekintés** (Overview) | Quick stats + a recent activity feed pulled from every table — every item links straight to its page (tasks deep-link into their detail view) |
| **Naptár** (Calendar) | Month view of every dated item across the app — task due dates, order delivery dates, marketing seasons, and when suppliers/documents/ideas were added — each category color-coded, click a day to see and open its events |
| **Beszállítók** (Suppliers) | Full supplier profiles grouped by category — basic info (name/category/country), contact details (website/email/phone/WhatsApp), a repeatable products/services list (name, price, MOQ, note per row), a **Kapott árajánlatok** section listing every price quote received from this supplier across all kártya-fájl versions (mennyiség/egységár/összár, dátum, kiválasztva-e), contact status (contacted/replied, sent-email text, contract status + valid-until date), general notes, a real **Email küldése** button, keresés, and CSV bulk import/export |
| **Feladatok** (Tasks) | Kanban board — Teendő / Folyamatban / Kész, drag & drop, priority, due date, assignee, keresés, CSV export. Click a card to open its full detail view (all fields + a free-form Megjegyzés/notes field, with Mentés/Mégse/Törlés buttons). **Sablonból hozzáadás**: pick any number of preset task templates (grouped by category, checkboxes) and add them all as Teendő tasks in one go; **Sablonok kezelése** (gear icon) is the full CRUD editor for those templates — create/edit/delete, with categories chosen from existing ones or typed fresh |
| **Megrendelések** (Orders) | Customer orders — vevő, termék, mennyiség, egységár, szállítási határidő, státusz (Új → Feldolgozás alatt → Kiszállítva → Teljesítve), optional notes, **Email küldése**, keresés, CSV export |
| **Pénzügyek** (Finance) | Planning calculator (price / COGS / units), plus a **Tényleges bevétel** section computed from real Megrendelések egységár data |
| **Marketing** | 4 fixed seasonal campaign cards (Tavasz/Nyár/Ősz/Tél) — editable theme & product focus, **Email küldése** |
| **Igényfelmérés** (Demand) | Live results from the `/landing` survey and Gold Card letters — bar charts for "would you buy?", price sensitivity and package-item popularity, plus lists of ideas and emails |
| **Dokumentumok** (Documents) | Simple document library with file upload to Supabase Storage, **Email küldése** (pre-filled with a link to the file), keresés |
| **Kártya-fájlok** (Card assets) | Versioned print-ready card files, grouped by language (HU/DE/EN) — upload either a ready-made ZIP or an entire folder (zipped in the browser on the fly, subfolders included) with a version label, nyomtatási állapot, optional beszállító/rendelés dátuma/mennyiség and notes. On upload, the server unzips it and pulls out up to 4 preview thumbnails by filename (front/back/wild/goldcard) shown in a small grid on each version. Click a version to open its full detail (untruncated notes, download, delete) and optionally spin a **Feladat** off of it — the new task shows up on the Feladatok board like any other. Each version also has an expandable **Árajánlatok** section — an "+ Új árajánlat hozzáadása" form (beszállító legördülő, mennyiség, egységár + pénznem, kép feltöltése, megjegyzés, dátum) and a list of every price quote received for that version, with a star toggle to mark the accepted one (highlighted green); quotes and suppliers are linked both ways, so the same registry shows up on the supplier's profile too. The most recent upload per language is flagged **Legújabb** |
| **Jövőbeli tervek** (Future Plans) | Idea backlog — Ötlet / Fontolgatva / Tervezve |

Every delete action (Beszállítók, Feladatok, Pénzügyek, Dokumentumok,
Jövőbeli tervek, Megrendelések) removes the row immediately and shows a
**Visszavonás** (undo) toast for a few seconds before it's actually deleted
from Supabase — nothing is lost to a stray click.

**Email küldése** (Suppliers, Megrendelések, Dokumentumok, Marketing): a
real send button — opens a small compose window (to / subject / message),
and Küldés actually sends it via [Resend](https://resend.com). On
Suppliers specifically, a successful send also auto-fills the existing
"Kiküldött email" field with what was sent and ticks "Megkeresve". Needs
`RESEND_API_KEY` set — see [Set up email sending](#2-set-up-email-sending-resend)
below; without it the send button shows a clear error instead of failing
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

## `/landing` — public customer-facing page

A separate, standalone page (no dashboard chrome, no Basic Auth lock even
if you enable one — see below) at `/landing`, linked from the dashboard
sidebar. It's an interactive funnel — founder story, a sample card demo,
a "gold card" letter prompt, a package builder, a short survey — with a
DE/EN language toggle in the top corner. Survey responses and letters are
saved to Supabase (`landing_responses`, `landing_letters`); a small
password-gated "founder view" (bottom-right link, password
`zusammen2026` — change it in `app/landing/page.tsx`) shows aggregate
stats pulled from those tables.

---

## 1. Set up Supabase (free tier)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any
   name/region and a database password (save it somewhere safe — you
   won't need it for this app, but Supabase asks for it).
2. Once the project is ready, open **SQL Editor** in the left sidebar →
   **New query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo,
   copy its entire contents, paste into the SQL editor, and click **Run**.
   This creates all the tables, seeds the 4 marketing seasons, sets up
   Row Level Security, and creates the `documents`, `card-assets`, and
   `price-quotes` Storage buckets used for file uploads. Safe to re-run
   any time you pull schema changes — every statement is guarded so it
   won't fail or duplicate data on a second run.
4. Go to **Project Settings → API**. You'll need two values from here:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

That's it — the database, tables, and file storage are ready.

> **Note on security:** this app talks to Supabase with the public
> "anon" key directly from the browser, which is normal for a
> single-user tool like this. Row Level Security is enabled with
> permissive policies so the anon key can read/write your tables — real
> protection comes from keeping your dashboard URL private, or turning
> on the optional password lock below.

### Optional: password-protect the whole dashboard

The app ships with a simple Basic Auth check (`proxy.ts`). If you
set **both** `DASHBOARD_USER` and `DASHBOARD_PASSWORD` as environment
variables, every page will ask for a username/password in the browser
before loading. Leave them unset to keep the dashboard open to anyone
with the link.

---

## 2. Set up email sending (Resend)

The **Email küldése** buttons (Beszállítók, Megrendelések, Dokumentumok,
Marketing) send real emails through [Resend](https://resend.com) — a
free-tier-friendly email API. Setup takes about 5 minutes:

1. Go to [resend.com](https://resend.com) → **Sign up** (free — 3,000
   emails/month, 100/day is plenty for this).
2. In the Resend dashboard, open **API Keys** → **Create API Key**. Give
   it any name (e.g. "Zusammen dashboard"), leave permissions as
   "Full access", and copy the key — it starts with `re_` and is only
   shown once.
3. Add it as an environment variable named `RESEND_API_KEY`:
   - **Locally**: paste it into `.env.local` (see step 2 below).
   - **On Vercel**: Project → Settings → Environment Variables (same place
     as the Supabase keys — see the deploy step below).

That's it — sending works immediately using Resend's shared
`onboarding@resend.dev` sender, with replies routed to
`zusammen.swiss@gmail.com` (set in `app/api/send-email/route.ts`).

> **About the sender address.** Resend (like every email API) can't send
> "from" an address on a domain you don't own — so it can't send as
> `zusammen.swiss@gmail.com` no matter what. `onboarding@resend.dev` is
> Resend's own shared testing domain: it works with no setup, but
> recipients will see it's not a custom domain, and Resend may rate-limit
> or restrict it more than a verified sender. **If/when you have your own
> domain** (e.g. `zusammenswiss.ch`), verify it in Resend under
> **Domains → Add Domain** (a few DNS records to add at your domain
> registrar), then set two more environment variables to switch over —
> no code changes needed:
> - `RESEND_FROM_EMAIL` — e.g. `Zusammen <hello@zusammenswiss.ch>`
> - `RESEND_REPLY_TO` — where replies should land (defaults to
>   `zusammen.swiss@gmail.com` if unset)

---

## 3. Set up the daily reminder email (optional)

This reuses the Resend setup above (step 2) to send one summary email a
day — skip this section if you don't want it; the rest of the app works
fine without it.

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
components/              Shared UI (nav, cards, empty states, feedback)
lib/supabase/client.ts   Browser Supabase client
lib/supabase/types.ts    Hand-written types matching supabase/schema.sql
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
