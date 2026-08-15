# Zusammen — Founder Dashboard

A personal launch-tracking dashboard for **Zusammen**, a Swiss premium
conversation-card brand. Built for a single user (the founder) — no
login system, just a private tool to track suppliers, tasks, finances,
marketing, documents, and future ideas in one place.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS · Supabase
(Postgres + Storage) · deploy target: Vercel.

## Pages

| Page | What it does |
|---|---|
| **Overview** | Quick stats + a recent activity feed pulled from every table |
| **Suppliers** | Manufacturer/supplier contacts — contacted / reply-received checkboxes, notes, optional pasted email text |
| **Tasks** | Kanban board — Teendő / Folyamatban / Kész, drag & drop, priority, due date, assignee |
| **Finance** | Product rows (price / COGS / units) with auto-computed revenue & margin |
| **Marketing** | 4 fixed seasonal campaign cards (Spring / Summer / Autumn / Winter) — editable theme & product focus |
| **Documents** | Simple document library with file upload to Supabase Storage |
| **Future Plans** | Idea backlog — Idea / Considering / Planned |

---

## 1. Set up Supabase (free tier)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any
   name/region and a database password (save it somewhere safe — you
   won't need it for this app, but Supabase asks for it).
2. Once the project is ready, open **SQL Editor** in the left sidebar →
   **New query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo,
   copy its entire contents, paste into the SQL editor, and click **Run**.
   This creates all 6 tables, seeds the 4 marketing seasons, sets up
   Row Level Security, and creates the `documents` Storage bucket used
   for file uploads.
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

## 2. Run it locally (optional)

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste in your Supabase URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 3. Deploy to Vercel (get a real URL)

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
   | `DASHBOARD_USER` *(optional)* | a username, to lock the dashboard |
   | `DASHBOARD_PASSWORD` *(optional)* | a password, to lock the dashboard |
6. Click **Deploy**. In about a minute you'll get a live URL like
   `https://zusammen-dashboard.vercel.app`.

Every time you push to your main branch, Vercel redeploys automatically.

---

## Project structure

```
app/                    Next.js App Router pages (one folder per tab)
components/             Shared UI (nav, cards, empty states, feedback)
lib/supabase/client.ts  Browser Supabase client
lib/supabase/types.ts   Hand-written types matching supabase/schema.sql
lib/format.ts           Currency/date formatting helpers
supabase/schema.sql     Full database schema — run once in Supabase
proxy.ts                Optional Basic Auth lock
```

## Customizing

- **Brand colors & fonts** live in `app/globals.css` (`:root` custom
  properties) — Forest Green, Warm Ivory, Bronze Gold, Walnut Brown, plus
  the Fraunces (serif headings) / Inter (sans body) font pairing from
  `app/layout.tsx`.
- **Schema changes**: edit `supabase/schema.sql`, re-run the relevant
  parts in the Supabase SQL editor, then update
  `lib/supabase/types.ts` to match.
