-- =====================================================================
-- Zusammen Founder Dashboard — Supabase schema
-- =====================================================================
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  country text,
  website text,
  contact_email text,
  phone text,
  whatsapp text,
  -- Array of { id, name, price, moq, note } objects — a supplier can offer
  -- any number of products/services, edited as repeatable rows in the UI.
  products jsonb not null default '[]'::jsonb,
  contacted boolean not null default false,
  reply_received boolean not null default false,
  notes text,
  email_text text,
  contract_status text not null default 'None' check (contract_status in ('None', 'Signed', 'Failed', 'Expired')),
  contract_valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial launch — safe no-op if the columns already exist.
alter table public.suppliers add column if not exists contact_email text;
alter table public.suppliers add column if not exists country text;
alter table public.suppliers add column if not exists website text;
alter table public.suppliers add column if not exists phone text;
alter table public.suppliers add column if not exists whatsapp text;
alter table public.suppliers add column if not exists products jsonb not null default '[]'::jsonb;
alter table public.suppliers add column if not exists contract_status text not null default 'None';
alter table public.suppliers add column if not exists contract_valid_until date;

-- Guard the check constraint separately so re-running this file never
-- fails with "constraint already exists".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suppliers_contract_status_check'
  ) then
    alter table public.suppliers
      add constraint suppliers_contract_status_check
      check (contract_status in ('None', 'Signed', 'Failed', 'Expired'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tasks (Kanban board)
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  status text not null default 'Teendő' check (status in ('Teendő', 'Folyamatban', 'Kész')),
  due_date date,
  assignee text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial launch — safe no-op if the column already exists.
alter table public.tasks add column if not exists notes text;

-- Archiving for "Kész" tasks — set when a task is archived, null while
-- active. Keeps the Kanban board's Kész column from growing forever
-- while preserving history (still exportable, still in Supabase) rather
-- than deleting it outright.
alter table public.tasks add column if not exists archived_at timestamptz;

-- Típus dimension, independent of the free-text category field — lets
-- the Kanban board visually and by-filter distinguish one-off tasks from
-- ones that came out of the recurring-template engine (see
-- lib/recurring-templates.ts, which sets this automatically) or that
-- belong to a marketing push (set automatically by "→ Feladat
-- létrehozása" on a Tartalom-naptár item — see app/(dashboard)/marketing).
alter table public.tasks add column if not exists task_type text not null default 'Egyszeri';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_task_type_check'
  ) then
    alter table public.tasks
      add constraint tasks_task_type_check
      check (task_type in ('Egyszeri', 'Ismétlődő', 'Kampány'));
  end if;
end $$;

-- Which campaign a "Kampány"-típusú task belongs to — originally plain
-- text (a free-form label), later turned into a real FK once a
-- campaigns table existed to point to. See the campaigns table and the
-- tasks.campaign_id/campaign_label migration much further down this
-- file for the full story; on a truly fresh database this line just
-- creates the text column that migration immediately renames away.
alter table public.tasks add column if not exists campaign_id text;

-- Negyedik állapot: "Várakozás" — a founder-created task that's neither
-- to-do nor in-progress, just parked until a given day is worth
-- revisiting (e.g. waiting on a supplier's reply, a DNS record to
-- propagate, a shipment to move). check_date is that day; the badge/
-- quick-extend UI (TaskCard, app/(dashboard)/tasks/page.tsx) and the
-- daily digest (app/api/cron/check-date-digest) both key off it. The
-- inline check on `status` was created unnamed inside the original
-- `create table`, so re-adding it under its auto-generated name
-- (`tasks_status_check`) is the only way to widen it on an existing
-- database — safe to re-run: existing rows already satisfy the wider
-- constraint, so the validation the ADD CONSTRAINT step performs never
-- fails.
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('Várakozás', 'Teendő', 'Folyamatban', 'Kész'));
alter table public.tasks add column if not exists check_date date;

-- ---------------------------------------------------------------------
-- Task templates — presets for the "Sablonból hozzáadás" quick-add on
-- Feladatok and its "Sablonok kezelése" editor.
-- ---------------------------------------------------------------------
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  default_priority text not null default 'Medium' check (default_priority in ('Low', 'Medium', 'High')),
  default_assignee text,
  notes_template text,
  created_at timestamptz not null default now()
);

-- Guard the unique constraint separately so re-running this file never
-- fails with "constraint already exists".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'task_templates_title_category_key'
  ) then
    alter table public.task_templates
      add constraint task_templates_title_category_key unique (title, category);
  end if;
end $$;

alter table public.task_templates enable row level security;

drop policy if exists "anon full access" on public.task_templates;
drop policy if exists "authenticated full access" on public.task_templates;
create policy "authenticated full access" on public.task_templates for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Seed the starter template set — on conflict do nothing so re-running
-- this file never duplicates them, and any edits made in the app (via
-- "Sablonok kezelése") are left alone.
insert into public.task_templates (title, category, default_priority) values
  ('Follow-up email küldése, ha 1 hete nincs válasz', 'Beszállítók & Gyártás', 'High'),
  ('Új árajánlat bekérése', 'Beszállítók & Gyártás', 'Medium'),
  ('Minta rendelése', 'Beszállítók & Gyártás', 'Medium'),
  ('Kártya utánnyomás megrendelése', 'Beszállítók & Gyártás', 'High'),
  ('Travel Pouch utánrendelés', 'Beszállítók & Gyártás', 'Medium'),
  ('Kártya-fájlok frissítése új verzióval', 'Kártya-fájlok', 'High'),
  ('Új nyelvi verzió elkészítése', 'Kártya-fájlok', 'Medium'),
  ('Kártyaszöveg felülvizsgálata teszt-visszajelzések alapján', 'Kártya-fájlok', 'Medium'),
  ('Heti Instagram-poszt közzététele', 'Marketing', 'Medium'),
  ('Évszakos Connection Token tervezése/nyomtatása', 'Marketing', 'Medium'),
  ('Email-kampány kiküldése a feliratkozóknak', 'Marketing', 'High'),
  ('Demand-test link újra megosztása', 'Marketing', 'Low'),
  ('Negyedéves levél megírása', 'Gold Card Letters', 'High'),
  ('Levél-fotó feltöltése a Dashboardba', 'Gold Card Letters', 'Medium'),
  ('Havi pénzügyi áttekintés / modell frissítése', 'Pénzügy', 'Medium'),
  ('Negyedéves fedezeti pont ellenőrzése', 'Pénzügy', 'Medium'),
  ('AHV/Treuhand éves bejelentés ellenőrzése', 'Jogi & Adminisztráció', 'High'),
  ('Domain megújítás ellenőrzése', 'Jogi & Adminisztráció', 'Low'),
  ('Beérkezett Feedback-ek átnézése', 'Founder Journey & Közösség', 'Medium'),
  ('Founder Wall új bejegyzéseinek ellenőrzése', 'Founder Journey & Közösség', 'Low')
on conflict (title, category) do nothing;

-- Recurrence — a template can auto-generate a fresh "Teendő" task on its
-- own schedule instead of only being picked by hand. recurrence_type/
-- recurrence_interval/next_due_date are only meaningful once is_recurring
-- is true; see lib/recurring-templates.ts for the due-check + advance
-- math, run from app/(dashboard)/tasks/page.tsx on every page load
-- (there's deliberately no cron for this — see that lib file's comment).
alter table public.task_templates add column if not exists is_recurring boolean not null default false;
alter table public.task_templates add column if not exists recurrence_type text
  check (recurrence_type in ('Napi', 'Heti', 'Havi', 'Negyedéves', 'Éves'));
alter table public.task_templates add column if not exists recurrence_interval integer not null default 1
  check (recurrence_interval > 0);
alter table public.task_templates add column if not exists next_due_date date;

-- Backfill recurrence settings on the founder's already-existing
-- templates that are naturally recurring. next_due_date starts at
-- current_date, so the first occurrence shows up as due the next time
-- Feladatok is opened, then rolls forward on its own schedule from
-- there. Guarded by `is_recurring is not true` so a second run of this
-- file — after the automation has already advanced a template's real
-- next_due_date, or the founder edited it by hand — never resets it
-- back to today.
update public.task_templates set is_recurring = true, recurrence_type = 'Havi', recurrence_interval = 1, next_due_date = current_date
  where title = 'Havi pénzügyi áttekintés / modell frissítése' and category = 'Pénzügy' and is_recurring is not true;
update public.task_templates set is_recurring = true, recurrence_type = 'Negyedéves', recurrence_interval = 1, next_due_date = current_date
  where title = 'Negyedéves fedezeti pont ellenőrzése' and category = 'Pénzügy' and is_recurring is not true;
update public.task_templates set is_recurring = true, recurrence_type = 'Éves', recurrence_interval = 1, next_due_date = current_date
  where title = 'AHV/Treuhand éves bejelentés ellenőrzése' and category = 'Jogi & Adminisztráció' and is_recurring is not true;
update public.task_templates set is_recurring = true, recurrence_type = 'Éves', recurrence_interval = 1, next_due_date = current_date
  where title = 'Domain megújítás ellenőrzése' and category = 'Jogi & Adminisztráció' and is_recurring is not true;
update public.task_templates set is_recurring = true, recurrence_type = 'Heti', recurrence_interval = 1, next_due_date = current_date
  where title = 'Heti Instagram-poszt közzététele' and category = 'Marketing' and is_recurring is not true;
update public.task_templates set is_recurring = true, recurrence_type = 'Heti', recurrence_interval = 1, next_due_date = current_date
  where title = 'Beérkezett Feedback-ek átnézése' and category = 'Founder Journey & Közösség' and is_recurring is not true;
update public.task_templates set is_recurring = true, recurrence_type = 'Heti', recurrence_interval = 1, next_due_date = current_date
  where title = 'Founder Wall új bejegyzéseinek ellenőrzése' and category = 'Founder Journey & Közösség' and is_recurring is not true;

-- Sablon-alapú "Várakozás" — a Sablonból hozzáadás picker (és a
-- Sablonkezelő szerkesztő form) ezt olvassa, hogy egy sablonból
-- létrehozott feladat rögtön Várakozás állapotban, kiszámolt
-- check_date-tel jöjjön létre, a felelős kézi beállítása nélkül. Csak
-- 'Teendő'/'Várakozás' érvényes — egy sablon sosem hoz létre Folyamatban/
-- Kész állapotú feladatot közvetlenül.
alter table public.task_templates add column if not exists default_status text not null default 'Teendő'
  check (default_status in ('Teendő', 'Várakozás'));
-- Csak akkor értelmezett, ha default_status = 'Várakozás' — hány nappal a
-- létrehozás után legyen az első check_date (lásd TemplatePickerModal).
alter table public.task_templates add column if not exists default_check_offset_days integer
  check (default_check_offset_days > 0);

-- Új, visszatérően előforduló, de eddig sablon nélküli teendők — 3
-- "Várakozás" alapértelmezésű (a founder elindítja, aztán X nap múlva
-- automatikusan figyelmeztet, hogy nézze meg újra), plusz egy sima heti
-- ismétlődő. on conflict do nothing, mint a fenti kezdő sablon-listánál.
insert into public.task_templates (title, category, default_priority, default_status, default_check_offset_days) values
  ('Beszállítói válasz ellenőrzése', 'Beszállítók & Gyártás', 'Medium', 'Várakozás', 3),
  ('DNS/domain-hitelesítés ellenőrzése', 'Jogi & Adminisztráció', 'Medium', 'Várakozás', 1),
  ('Csomag-nyomkövetés ellenőrzése', 'Beszállítók & Gyártás', 'Medium', 'Várakozás', 2)
on conflict (title, category) do nothing;

insert into public.task_templates (title, category, default_priority, is_recurring, recurrence_type, recurrence_interval, next_due_date) values
  ('Heti Aktivitás-napló átnézése', 'Founder Journey & Közösség', 'Low', true, 'Heti', 1, current_date)
on conflict (title, category) do nothing;

-- ---------------------------------------------------------------------
-- Finance — product rows for the revenue/margin calculator
-- ---------------------------------------------------------------------
create table if not exists public.finance_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12, 2) not null default 0,
  cogs numeric(12, 2) not null default 0,
  units numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Marketing — exactly 4 fixed seasonal campaign cards
-- ---------------------------------------------------------------------
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  season text not null unique check (season in ('Spring', 'Summer', 'Autumn', 'Winter')),
  theme text,
  product_focus text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Documents — simple document library, files live in Supabase Storage
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  status text default 'Draft',
  notes text,
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);

-- Cross-links to the task/supplier a document belongs to (e.g. a
-- contract tied to a supplier, or a reference file for an open task) —
-- same on-delete-set-null convention as expenses.related_supplier_id.
alter table public.documents add column if not exists related_task_id uuid references public.tasks(id) on delete set null;
alter table public.documents add column if not exists related_supplier_id uuid references public.suppliers(id) on delete set null;

-- ---------------------------------------------------------------------
-- Future Plans — idea backlog
-- ---------------------------------------------------------------------
create table if not exists public.future_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  status text not null default 'Idea' check (status in ('Idea', 'Considering', 'Planned')),
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orders — customer orders, tracked through to delivery
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  product text,
  quantity numeric(12, 2) not null default 1,
  -- Actual sold price per unit — separate from finance_products.price
  -- (the planning calculator) so real revenue can differ from what was
  -- originally planned (discounts, custom deals, etc).
  unit_price numeric(12, 2),
  delivery_date date,
  status text not null default 'New' check (status in ('New', 'Processing', 'Shipped', 'Done')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial launch — safe no-op if the columns already exist.
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists unit_price numeric(12, 2);

-- orders.product_id (FK into products) is added further down, right
-- after the Termékek katalógus table is created — it can't be added
-- here yet since public.products doesn't exist this early in a fresh
-- run of this file.

-- unit_price previously had no currency of its own, same situation and
-- same reasoning as products.sale_price_currency above — defaults to
-- CHF (this app's DEFAULT_CURRENCY) to match the number every existing
-- order already implicitly meant.
alter table public.orders add column if not exists unit_price_currency text not null default 'CHF';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_unit_price_currency_check'
  ) then
    alter table public.orders
      add constraint orders_unit_price_currency_check
      check (unit_price_currency in ('CHF', 'USD', 'EUR'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Seed the 4 marketing seasons if they don't exist yet
-- ---------------------------------------------------------------------
insert into public.marketing_campaigns (season, theme, product_focus)
values
  ('Spring', 'New beginnings', 'Introduce the starter conversation deck'),
  ('Summer', 'Gatherings & terraces', 'Gift sets for hosting and travel'),
  ('Autumn', 'Deeper conversations', 'Premium walnut-boxed edition'),
  ('Winter', 'Gifting season', 'Limited holiday edition + bundles')
on conflict (season) do nothing;

-- ---------------------------------------------------------------------
-- updated_at auto-touch trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.suppliers;
create trigger set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.marketing_campaigns;
create trigger set_updated_at before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- ---------------------------------------------------------------------
-- The dashboard talks to Supabase using the public "anon" key directly
-- from the browser — that key is embedded in the JS bundle and can't be
-- kept secret, so real protection has to come from RLS itself, not from
-- keeping the key hidden. Every founder-only table below uses
-- `auth.uid() is not null` — readable/writable only by a signed-in
-- Supabase Auth session (see app/login/page.tsx and proxy.ts), not by
-- the anon key alone. This is enforced by Postgres itself: even someone
-- who extracts the anon key from the deployed JS bundle can't read or
-- write these tables without also having valid founder (or teammate)
-- login credentials.
--
-- Three narrow exceptions, each intentional:
-- 1. `landing_letters`/`landing_responses`/`landing_page_views` allow
--    anon INSERT (real, logged-out /landing visitors submit these) but
--    restrict SELECT/UPDATE/DELETE to authenticated — so anyone can
--    write a survey response, but only the founder can read the list
--    back (previously anyone with the anon key could read every
--    visitor's email address).
-- 2. `gold_card_letters`/`journey_memories`/`wild_card_completions`/
--    `surprise_question_log`/`together_settings` stay on the permissive
--    anon policy — see the Közös tér (/together) comment further down
--    for why: that page's access code is a deliberate soft UX gate, not
--    a security boundary, and its visitor never holds a Supabase Auth
--    session to satisfy auth.uid() with.
-- 3. `gmail_connection` (see below) has no anon or authenticated policy
--    at all — it's reachable only through the service-role client.
--
-- Storage buckets: documents, card-assets, price-quotes, marketing,
-- company-logo and product-images are now private (`public = false`,
-- set right after each bucket's own `insert into storage.buckets`
-- below) — a founder-only file's URL is no longer enough on its own to
-- fetch it, the app exchanges the stored path for a short-lived signed
-- URL at read time (see lib/signed-storage-url.ts). Two buckets stay
-- `public = true` on purpose: gold-card-letters/journey-memories, read
-- by /together's visitor who never holds a Supabase Auth session to
-- request a signed URL with (same soft-gate reasoning as that table's
-- own policies, see further down), and email-assets, whose logo URL is
-- embedded straight into campaign HTML sent to external recipients —
-- their mail client fetches it anonymously, with no way to present a
-- signed URL's expiry-bound token as authentication.
-- =====================================================================
alter table public.suppliers enable row level security;
alter table public.tasks enable row level security;
alter table public.finance_products enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.documents enable row level security;
alter table public.future_plans enable row level security;
alter table public.orders enable row level security;

drop policy if exists "anon full access" on public.suppliers;
drop policy if exists "authenticated full access" on public.suppliers;
create policy "authenticated full access" on public.suppliers for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "anon full access" on public.tasks;
drop policy if exists "authenticated full access" on public.tasks;
create policy "authenticated full access" on public.tasks for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "anon full access" on public.finance_products;
drop policy if exists "authenticated full access" on public.finance_products;
create policy "authenticated full access" on public.finance_products for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "anon full access" on public.marketing_campaigns;
drop policy if exists "authenticated full access" on public.marketing_campaigns;
create policy "authenticated full access" on public.marketing_campaigns for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "anon full access" on public.documents;
drop policy if exists "authenticated full access" on public.documents;
create policy "authenticated full access" on public.documents for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "anon full access" on public.future_plans;
drop policy if exists "authenticated full access" on public.future_plans;
create policy "authenticated full access" on public.future_plans for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "anon full access" on public.orders;
drop policy if exists "authenticated full access" on public.orders;
create policy "authenticated full access" on public.orders for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- =====================================================================
-- Storage — bucket for uploaded documents
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Flips an existing bucket private on re-run — the insert above is a
-- no-op once the bucket already exists, so this is the statement that
-- actually does the work on a database created before this change.
update storage.buckets set public = false where id = 'documents';

drop policy if exists "documents bucket anon read" on storage.objects;
drop policy if exists "documents bucket authenticated read" on storage.objects;
create policy "documents bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "documents bucket anon write" on storage.objects;
drop policy if exists "documents bucket authenticated write" on storage.objects;
create policy "documents bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "documents bucket anon update" on storage.objects;
drop policy if exists "documents bucket authenticated update" on storage.objects;
create policy "documents bucket authenticated update"
  on storage.objects for update
  using (bucket_id = 'documents' and auth.uid() is not null);

drop policy if exists "documents bucket anon delete" on storage.objects;
drop policy if exists "documents bucket authenticated delete" on storage.objects;
create policy "documents bucket authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid() is not null);

-- ---------------------------------------------------------------------
-- Card assets — versioned print-ready card ZIP files, per language
-- ---------------------------------------------------------------------
create table if not exists public.card_assets (
  id uuid primary key default gen_random_uuid(),
  language text not null,
  version text not null,
  file_url text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Added after the initial launch — safe no-op if the columns already exist.
alter table public.card_assets add column if not exists print_status text not null default 'Piszkozat'
  check (print_status in ('Piszkozat', 'Nyomdának elküldve', 'Megrendelve', 'Megérkezett'));
alter table public.card_assets add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.card_assets add column if not exists order_date date;
alter table public.card_assets add column if not exists quantity numeric(12, 2);
-- Array of { label, url } previews auto-extracted from the ZIP on upload
-- (see app/api/card-assets/process) — front/back/wild/goldcard sample
-- images, whichever are found.
alter table public.card_assets add column if not exists thumbnails jsonb not null default '[]'::jsonb;

alter table public.card_assets enable row level security;

drop policy if exists "anon full access" on public.card_assets;
drop policy if exists "authenticated full access" on public.card_assets;
create policy "authenticated full access" on public.card_assets for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Storage — bucket for the uploaded card-asset ZIP files
insert into storage.buckets (id, name, public)
values ('card-assets', 'card-assets', true)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'card-assets';

drop policy if exists "card-assets bucket anon read" on storage.objects;
drop policy if exists "card-assets bucket authenticated read" on storage.objects;
create policy "card-assets bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'card-assets' and auth.uid() is not null);

drop policy if exists "card-assets bucket anon write" on storage.objects;
drop policy if exists "card-assets bucket authenticated write" on storage.objects;
create policy "card-assets bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'card-assets' and auth.uid() is not null);

drop policy if exists "card-assets bucket anon update" on storage.objects;
drop policy if exists "card-assets bucket authenticated update" on storage.objects;
create policy "card-assets bucket authenticated update"
  on storage.objects for update
  using (bucket_id = 'card-assets' and auth.uid() is not null);

drop policy if exists "card-assets bucket anon delete" on storage.objects;
drop policy if exists "card-assets bucket authenticated delete" on storage.objects;
create policy "card-assets bucket authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'card-assets' and auth.uid() is not null);

-- ---------------------------------------------------------------------
-- Price quotes — supplier offers received for a given card-asset version
-- ---------------------------------------------------------------------
create table if not exists public.price_quotes (
  id uuid primary key default gen_random_uuid(),
  card_asset_id uuid not null references public.card_assets(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  quantity numeric(12, 2) not null,
  unit_price numeric(12, 2),
  currency text,
  total_price numeric(12, 2),
  screenshot_url text,
  notes text,
  quote_date date not null default current_date,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.price_quotes enable row level security;

drop policy if exists "anon full access" on public.price_quotes;
drop policy if exists "authenticated full access" on public.price_quotes;
create policy "authenticated full access" on public.price_quotes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Storage — bucket for uploaded price-quote screenshots
insert into storage.buckets (id, name, public)
values ('price-quotes', 'price-quotes', true)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'price-quotes';

drop policy if exists "price-quotes bucket anon read" on storage.objects;
drop policy if exists "price-quotes bucket authenticated read" on storage.objects;
create policy "price-quotes bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'price-quotes' and auth.uid() is not null);

drop policy if exists "price-quotes bucket anon write" on storage.objects;
drop policy if exists "price-quotes bucket authenticated write" on storage.objects;
create policy "price-quotes bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'price-quotes' and auth.uid() is not null);

drop policy if exists "price-quotes bucket anon update" on storage.objects;
drop policy if exists "price-quotes bucket authenticated update" on storage.objects;
create policy "price-quotes bucket authenticated update"
  on storage.objects for update
  using (bucket_id = 'price-quotes' and auth.uid() is not null);

drop policy if exists "price-quotes bucket anon delete" on storage.objects;
drop policy if exists "price-quotes bucket authenticated delete" on storage.objects;
create policy "price-quotes bucket authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'price-quotes' and auth.uid() is not null);

-- ---------------------------------------------------------------------
-- Marketing content calendar — individual posts/stories/emails/campaigns
-- scheduled against a date, optionally tied to one of the 4 seasonal
-- campaigns above.
-- ---------------------------------------------------------------------
create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_type text not null
    check (content_type in ('Instagram poszt', 'Instagram story', 'Email', 'Kampány')),
  -- References marketing_campaigns.season (unique) rather than a bare
  -- check constraint, so this stays a real relation to the seasonal
  -- strategy card it belongs to, if any.
  season text references public.marketing_campaigns(season) on delete set null,
  scheduled_date date not null,
  copy_text text,
  image_url text,
  status text not null default 'Ötlet'
    check (status in ('Ötlet', 'Tervezve', 'Ütemezve', 'Kiküldve')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_content enable row level security;

drop policy if exists "anon full access" on public.marketing_content;
drop policy if exists "authenticated full access" on public.marketing_content;
create policy "authenticated full access" on public.marketing_content for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.marketing_content;
create trigger set_updated_at before update on public.marketing_content
  for each row execute function public.set_updated_at();

-- Marketing asset library — reusable images (grouped by language in the
-- UI), independent of any one scheduled content item.
create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  language text not null check (language in ('HU', 'EN', 'DE')),
  platform text,
  season text references public.marketing_campaigns(season) on delete set null,
  image_url text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- What the image actually is, so it's never mistaken for something it
-- isn't further down the line (e.g. a "Koncepció" mockup accidentally
-- used as a real webshop product photo) — shown as a prominent badge on
-- every asset card.
alter table public.marketing_assets
  add column if not exists asset_type text not null default 'Koncepció'
    check (asset_type in ('Koncepció', 'Valódi termékfotó', 'Lifestyle'));

alter table public.marketing_assets enable row level security;

drop policy if exists "anon full access" on public.marketing_assets;
drop policy if exists "authenticated full access" on public.marketing_assets;
create policy "authenticated full access" on public.marketing_assets for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Lets a content-calendar item point at a saved asset instead of
-- uploading its own copy of the same image — set null (not cascaded) if
-- the asset is later deleted, so the content item survives.
alter table public.marketing_content
  add column if not exists asset_id uuid references public.marketing_assets(id) on delete set null;

-- Storage — shared bucket for both marketing_content and marketing_assets
-- images
insert into storage.buckets (id, name, public)
values ('marketing', 'marketing', true)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'marketing';

drop policy if exists "marketing bucket anon read" on storage.objects;
drop policy if exists "marketing bucket authenticated read" on storage.objects;
create policy "marketing bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'marketing' and auth.uid() is not null);

drop policy if exists "marketing bucket anon write" on storage.objects;
drop policy if exists "marketing bucket authenticated write" on storage.objects;
create policy "marketing bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'marketing' and auth.uid() is not null);

drop policy if exists "marketing bucket anon update" on storage.objects;
drop policy if exists "marketing bucket authenticated update" on storage.objects;
create policy "marketing bucket authenticated update"
  on storage.objects for update
  using (bucket_id = 'marketing' and auth.uid() is not null);

drop policy if exists "marketing bucket anon delete" on storage.objects;
drop policy if exists "marketing bucket authenticated delete" on storage.objects;
create policy "marketing bucket authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'marketing' and auth.uid() is not null);

-- "→ Feladat létrehozása" link — a task spun off a content-calendar item
-- (see app/(dashboard)/marketing/page.tsx) keeps a reference back to it,
-- set null (not cascaded) if the content item is later deleted so the
-- task itself survives.
alter table public.tasks
  add column if not exists content_id uuid references public.marketing_content(id) on delete set null;

-- When a task tied to a content item is marked "Kész", flip that
-- content item's status to "Kiküldve" automatically — this only needs
-- to run once, wherever the status update actually happens (drag-and-
-- drop, the detail modal, …), so it lives here as a DB trigger instead
-- of being duplicated in every place tasks.status can change.
create or replace function public.mark_content_sent_on_task_done()
returns trigger as $$
begin
  if new.content_id is not null
     and new.status = 'Kész'
     and old.status is distinct from 'Kész' then
    update public.marketing_content set status = 'Kiküldve' where id = new.content_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists mark_content_sent_on_task_done on public.tasks;
create trigger mark_content_sent_on_task_done after update on public.tasks
  for each row execute function public.mark_content_sent_on_task_done();

-- =====================================================================
-- Landing page (/landing) — public customer-facing funnel
-- ---------------------------------------------------------------------
-- Unlike most of this schema, these tables are written to by anonymous
-- site visitors, not just the founder — hence the split RLS policy
-- (public insert, authenticated-only read/update/delete) instead of the
-- plain "authenticated full access" used elsewhere. The old in-page
-- "founder view" on /landing itself, gated only by a client-side
-- password prompt, has been removed for exactly this reason — it read
-- these tables with the anon key, which the split policy now blocks;
-- the founder's real, Supabase-Auth-protected replacement is the
-- Igényfelmérés dashboard page.
-- =====================================================================
create table if not exists public.landing_letters (
  id uuid primary key default gen_random_uuid(),
  letter_text text not null,
  lang text not null default 'en' check (lang in ('de', 'en')),
  created_at timestamptz not null default now()
);

create table if not exists public.landing_responses (
  id uuid primary key default gen_random_uuid(),
  would_buy text,
  price_range text,
  idea text,
  email text,
  box_items text[] not null default '{}',
  lang text not null default 'en' check (lang in ('de', 'en')),
  created_at timestamptz not null default now()
);

alter table public.landing_letters enable row level security;
alter table public.landing_responses enable row level security;

drop policy if exists "anon full access" on public.landing_letters;
drop policy if exists "public insert, authenticated manage" on public.landing_letters;
create policy "public insert, authenticated manage" on public.landing_letters for all
  using (auth.uid() is not null) with check (true);

drop policy if exists "anon full access" on public.landing_responses;
drop policy if exists "public insert, authenticated manage" on public.landing_responses;
create policy "public insert, authenticated manage" on public.landing_responses for all
  using (auth.uid() is not null) with check (true);

-- ---------------------------------------------------------------------
-- Landing oldal látogatottság — egy sor minden /landing betöltésnél
-- (LandingClient.tsx, egyszer mountkor, nem minden nyelv/képernyő-
-- váltásnál). Szándékosan minimális: se IP, se egyedi látogató-azonosító
-- nem kerül tárolásra, csak egy időbélyeg és a nyelv — elég egy durva
-- "hányan jutottak el idáig" számhoz (Igényfelmérés oldal), anélkül,
-- hogy bármilyen személyes/követési adatot gyűjtenénk.
-- ---------------------------------------------------------------------
create table if not exists public.landing_page_views (
  id uuid primary key default gen_random_uuid(),
  lang text not null default 'en' check (lang in ('de', 'en')),
  created_at timestamptz not null default now()
);

alter table public.landing_page_views enable row level security;

drop policy if exists "anon full access" on public.landing_page_views;
drop policy if exists "public insert, authenticated manage" on public.landing_page_views;
create policy "public insert, authenticated manage" on public.landing_page_views for all
  using (auth.uid() is not null) with check (true);

-- =====================================================================
-- Személyes rituálé — Gold Card Letters, Personal Journey (Passport) and
-- the Surprise Question drawer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Gold Card Letters — one sealed envelope per quarter. seq_number is the
-- 1-based letter number (1st, 2nd, 3rd, 4th…), used to compute the 4
-- seal-icon progress row and the "next letter in X days" countdown
-- (first round 2026-09-01, then every 3 months).
-- ---------------------------------------------------------------------
create table if not exists public.gold_card_letters (
  id uuid primary key default gen_random_uuid(),
  seq_number integer not null,
  sealed_date date not null default current_date,
  uploaded_by text not null,
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.gold_card_letters enable row level security;

drop policy if exists "anon full access" on public.gold_card_letters;
create policy "anon full access" on public.gold_card_letters for all using (true) with check (true);

-- Storage — bucket for the (blurred-in-UI) Gold Card Letter photos
insert into storage.buckets (id, name, public)
values ('gold-card-letters', 'gold-card-letters', true)
on conflict (id) do nothing;

drop policy if exists "gold-card-letters bucket anon read" on storage.objects;
create policy "gold-card-letters bucket anon read"
  on storage.objects for select
  using (bucket_id = 'gold-card-letters');

drop policy if exists "gold-card-letters bucket anon write" on storage.objects;
create policy "gold-card-letters bucket anon write"
  on storage.objects for insert
  with check (bucket_id = 'gold-card-letters');

drop policy if exists "gold-card-letters bucket anon update" on storage.objects;
create policy "gold-card-letters bucket anon update"
  on storage.objects for update
  using (bucket_id = 'gold-card-letters');

drop policy if exists "gold-card-letters bucket anon delete" on storage.objects;
create policy "gold-card-letters bucket anon delete"
  on storage.objects for delete
  using (bucket_id = 'gold-card-letters');

-- ---------------------------------------------------------------------
-- Personal Journey (Passport) — free-form memory log entries.
-- ---------------------------------------------------------------------
create table if not exists public.journey_memories (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  place text not null,
  experience text not null,
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.journey_memories enable row level security;

drop policy if exists "anon full access" on public.journey_memories;
create policy "anon full access" on public.journey_memories for all using (true) with check (true);

-- Storage — bucket for optional journey memory photos
insert into storage.buckets (id, name, public)
values ('journey-memories', 'journey-memories', true)
on conflict (id) do nothing;

drop policy if exists "journey-memories bucket anon read" on storage.objects;
create policy "journey-memories bucket anon read"
  on storage.objects for select
  using (bucket_id = 'journey-memories');

drop policy if exists "journey-memories bucket anon write" on storage.objects;
create policy "journey-memories bucket anon write"
  on storage.objects for insert
  with check (bucket_id = 'journey-memories');

drop policy if exists "journey-memories bucket anon update" on storage.objects;
create policy "journey-memories bucket anon update"
  on storage.objects for update
  using (bucket_id = 'journey-memories');

drop policy if exists "journey-memories bucket anon delete" on storage.objects;
create policy "journey-memories bucket anon delete"
  on storage.objects for delete
  using (bucket_id = 'journey-memories');

-- ---------------------------------------------------------------------
-- Personal Journey (Passport) — the 5 fixed Wild Cards. One row per
-- completion; wildcard_name is unique so re-running a "Teljesítve" click
-- on an already-completed card simply isn't offered again in the UI
-- (keeps the "X/5 completed" progress a plain row count).
-- ---------------------------------------------------------------------
create table if not exists public.wild_card_completions (
  id uuid primary key default gen_random_uuid(),
  wildcard_name text not null unique
    check (wildcard_name in ('Coffee Break', 'Silence', 'Memory', 'Adventure', 'Gratitude')),
  completed_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table public.wild_card_completions enable row level security;

drop policy if exists "anon full access" on public.wild_card_completions;
create policy "anon full access" on public.wild_card_completions for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- Surprise Question — logs each "Húzz egy lapot" draw so it can show up
-- in the Áttekintés activity feed like everything else in this section.
-- ---------------------------------------------------------------------
create table if not exists public.surprise_question_log (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  created_at timestamptz not null default now()
);

alter table public.surprise_question_log enable row level security;

drop policy if exists "anon full access" on public.surprise_question_log;
create policy "anon full access" on public.surprise_question_log for all using (true) with check (true);

-- =====================================================================
-- Megosztások (Shares) — press/influencer/friends contact list + a log
-- of every time the /landing demand-test link was emailed out.
-- =====================================================================
create table if not exists public.share_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  category text not null default 'Egyéb'
    check (category in ('Sajtó', 'Influencer', 'Ismerős', 'Egyéb')),
  contacted boolean not null default false,
  email_text text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.share_contacts enable row level security;

drop policy if exists "anon full access" on public.share_contacts;
drop policy if exists "authenticated full access" on public.share_contacts;
create policy "authenticated full access" on public.share_contacts for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.share_contacts;
create trigger set_updated_at before update on public.share_contacts
  for each row execute function public.set_updated_at();

create table if not exists public.demand_link_shares (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.share_contacts(id) on delete set null,
  recipient_name text,
  recipient_email text not null,
  email_text text,
  created_at timestamptz not null default now()
);

alter table public.demand_link_shares enable row level security;

drop policy if exists "anon full access" on public.demand_link_shares;
drop policy if exists "authenticated full access" on public.demand_link_shares;
create policy "authenticated full access" on public.demand_link_shares for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- =====================================================================
-- Gmail connection — stores the OAuth refresh token used to send email
-- as zusammen.swiss@gmail.com via the Gmail API (see lib/email/). This
-- is a genuine secret (an encrypted refresh token that grants send-as
-- access), unlike every other table in this file, so it is deliberately
-- NOT given an "anon full access" policy — RLS is enabled with zero
-- policies, which blocks the anon key entirely. Only the server-side
-- Supabase client authenticated with SUPABASE_SERVICE_ROLE_KEY (which
-- bypasses RLS) can read or write it — see lib/supabase/serverClient.ts.
-- Never add an anon/authenticated policy to this table.
-- =====================================================================
create table if not exists public.gmail_connection (
  id uuid primary key default gen_random_uuid(),
  google_email text,
  encrypted_refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_connection enable row level security;

drop trigger if exists set_updated_at on public.gmail_connection;
create trigger set_updated_at before update on public.gmail_connection
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Közös tér (/together) — a partner-shared view of the Személyes rituálé
-- (Gold Card Letters, Journey/Passport, Wild Cards, Meglepetés kérdés),
-- reached via a short access code instead of the founder dashboard —
-- which, notably, has no login of its own either. The code is a soft UX
-- gate for a two-person page, not a security boundary: like every table
-- in this file except gmail_connection above (which holds a real OAuth
-- secret), it gets the same permissive anon policy already used
-- everywhere, including on the fully public /landing page. Don't read
-- more security into this table than that.
-- =====================================================================
create table if not exists public.together_settings (
  id uuid primary key default gen_random_uuid(),
  access_code text not null,
  -- Planned/estimated Café to Connect opening date — either person can
  -- set or change it from the /together hero, hence no "who set it"
  -- column; NULL shows the symbolic "still on the way" copy instead.
  opening_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.together_settings enable row level security;

drop policy if exists "anon full access" on public.together_settings;
create policy "anon full access" on public.together_settings for all using (true) with check (true);

drop trigger if exists set_updated_at on public.together_settings;
create trigger set_updated_at before update on public.together_settings
  for each row execute function public.set_updated_at();

-- "Ki rögzítette" attribution for entries added from /together — filled
-- from the viewer's locally-remembered name (see app/together), not
-- typed by hand. Nullable and backfilled with `add column if not
-- exists` since these three tables predate this column.
alter table public.gold_card_letters add column if not exists added_by text;
alter table public.journey_memories add column if not exists added_by text;
alter table public.wild_card_completions add column if not exists added_by text;

-- =====================================================================
-- Company settings — a second singleton row, alongside together_settings
-- above, this time for the Beállítások page's Márka-adatok / Email-
-- aláírás / Naptár-integráció / Pénznem preferencia sections. Same
-- reasoning as together_settings: not a secret, gets the usual
-- permissive anon policy rather than the gmail_connection treatment.
-- =====================================================================
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  address text,
  phone text,
  email text,
  logo_url text,
  -- Appended to every email sent through /api/send-email — see that
  -- route. NULL/empty falls back to the DEFAULT_EMAIL_SIGNATURE
  -- constant in lib/company-settings.ts, not to a stored default here,
  -- so the fallback text lives in exactly one place.
  email_signature text,
  currency text not null default 'CHF' check (currency in ('CHF', 'USD', 'EUR')),
  -- Whether the negyedéves Gold Card Letters due-date shows up on
  -- Naptár and the "Következő Gold Card levél" countdown on Áttekintés
  -- — see the gating in those two pages. Sealed letters already on
  -- record keep showing either way; this only affects the forward-
  -- looking reminder.
  gold_card_reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

drop policy if exists "anon full access" on public.company_settings;
drop policy if exists "authenticated full access" on public.company_settings;
create policy "authenticated full access" on public.company_settings for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.company_settings;
create trigger set_updated_at before update on public.company_settings
  for each row execute function public.set_updated_at();

-- Storage — bucket for the company logo uploaded on Beállítások
insert into storage.buckets (id, name, public)
values ('company-logo', 'company-logo', true)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'company-logo';

drop policy if exists "company-logo bucket anon read" on storage.objects;
drop policy if exists "company-logo bucket authenticated read" on storage.objects;
create policy "company-logo bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'company-logo' and auth.uid() is not null);

drop policy if exists "company-logo bucket anon write" on storage.objects;
drop policy if exists "company-logo bucket authenticated write" on storage.objects;
create policy "company-logo bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'company-logo' and auth.uid() is not null);

-- =====================================================================
-- Naptár — kézzel felvett egyedi események (a többi Naptár-esemény más
-- táblákból van aggregálva, ezek viszont önálló bejegyzések, semmilyen
-- más rekordhoz nem kötődnek). Ugyanaz az "authenticated full access"
-- minta, mint a legtöbb más táblánál.
-- =====================================================================
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  -- Free text ("14:00", "délután") rather than a time column — this is a
  -- simple personal calendar note, not a scheduling system that needs to
  -- do time-zone-aware arithmetic on it.
  time text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists "anon full access" on public.calendar_events;
drop policy if exists "authenticated full access" on public.calendar_events;
create policy "authenticated full access" on public.calendar_events for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.calendar_events;
create trigger set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- iCal (.ics) feed subscription token — lives on company_settings
-- alongside everything else in Beállítások. See app/api/calendar/ics/
-- route.ts and the "Naptár feliratkozás" card on Beállítások. That route
-- reads it through the service-role client (company_settings itself now
-- requires auth.uid(), which a calendar app polling the URL could never
-- supply), then does its own equality check against the ?token= in the
-- request — a soft gate against the .ics URL being casually guessable
-- if it ever leaks out of a calendar app's own settings screen, not a
-- cryptographic secret.
alter table public.company_settings add column if not exists ics_token text;

-- =====================================================================
-- Termékek — the product catalog, linking each SKU/idea to its Kártya-
-- fájlok version and Beszállító. planned_units lives here too (not on a
-- separate finance_products row) so a product's price/COGS/volume is
-- only ever entered once — Pénzügyek reads straight from this table.
-- =====================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  edition text,
  status text not null default 'Fejlesztés alatt'
    check (status in ('Fejlesztés alatt', 'Tesztelés', 'Élő', 'Jövőbeli terv')),
  card_asset_id uuid references public.card_assets(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  cogs numeric(12, 2),
  -- Independent of Beállítások → Pénznem preferencia (a display-only
  -- setting) — this is the actual currency the cost was quoted in, so a
  -- USD COGS on a CHF sale price stays USD rather than getting silently
  -- relabeled. See sale_price_currency below and lib/exchange-rates.ts
  -- for how Pénzügyek now actually converts between these live, instead
  -- of just flagging the mismatch.
  cogs_currency text default 'CHF',
  sale_price numeric(12, 2),
  description text,
  production_note text,
  image_url text,
  planned_units numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after launch — sale_price previously had no currency of its own
-- (it silently followed whatever Beállítások → Pénznem was set to, see
-- lib/currency.ts's formatMoney comment). Defaulting existing rows to
-- CHF matches that previous implicit assumption exactly (CHF is this
-- app's DEFAULT_CURRENCY) — no founder-visible number changes on
-- upgrade, it just gives Pénzügyek's exchange-rate conversion a real
-- "from" currency to work with instead of guessing.
alter table public.products add column if not exists sale_price_currency text not null default 'CHF';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_sale_price_currency_check'
  ) then
    alter table public.products
      add constraint products_sale_price_currency_check
      check (sale_price_currency in ('CHF', 'USD', 'EUR'));
  end if;
end $$;

alter table public.products enable row level security;

drop policy if exists "anon full access" on public.products;
drop policy if exists "authenticated full access" on public.products;
create policy "authenticated full access" on public.products for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- orders.product_id — added here, not up with the rest of the orders
-- table's columns, since it needs public.products to already exist (a
-- fresh run of this file creates orders long before products). See the
-- comment up there for what this column is for.
alter table public.orders add column if not exists product_id uuid references public.products(id) on delete set null;

-- Storage — bucket for product photos
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'product-images';

drop policy if exists "product-images bucket anon read" on storage.objects;
drop policy if exists "product-images bucket authenticated read" on storage.objects;
create policy "product-images bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'product-images' and auth.uid() is not null);

drop policy if exists "product-images bucket anon write" on storage.objects;
drop policy if exists "product-images bucket authenticated write" on storage.objects;
create policy "product-images bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.uid() is not null);

-- Seed the starter catalog — on conflict do nothing so re-running this
-- file never duplicates them or overwrites any edits made in the app.
insert into public.products (name, edition, status, cogs, cogs_currency, sale_price, description, production_note) values
  (
    'Connection Cards', 'Pear Edition', 'Tesztelés', 6.77, 'USD', 29,
    '58 lapos beszélgetőkártya-pakli (52 kérdés + 5 Wild Card + 1 Gold Card)',
    null
  ),
  (
    'Gold Card', 'Pear Edition', 'Tesztelés', null, 'CHF', null,
    'A pakli 58. lapja — a levél-rituálé kártyája. A teszttételnél a többi kártyával együtt, normál színes nyomtatással készül.',
    'FONTOS — a végleges (nagy tételes) gyártásnál ez KÜLÖN nyomtatási folyamat lesz (valódi aranyfólia), nem mehet egyben a többi 57 lappal.'
  ),
  (
    'Zusammen Reconnect Box (Christmas Collection 2026)', 'Pear Edition kiegészítő', 'Fejlesztés alatt', 25, 'CHF', 49,
    'Karácsonyi ajándékdoboz pároknak — Connection Cards + lezárt "Open only after dessert" boríték 10 kérdéssel + zárt csoki/kávé szaszé + kis svájci csokoládé. Részletes terv a Dokumentumok fülön.',
    null
  ),
  ('Zusammen Ritual Kit', null, 'Jövőbeli terv', null, 'CHF', null, 'Connection Cards + Travel Pouch csomag', null),
  ('Signature Gift Box', null, 'Jövőbeli terv', null, 'CHF', 75, null, null),
  ('Corporate Gift', null, 'Jövőbeli terv', null, 'CHF', 65, null, null)
on conflict (name) do nothing;

-- =====================================================================
-- Email-kampányok (Marketing → Email sablonok) — Brevo-n keresztül
-- kiküldött kampányok sablonjai, feliratkozói és leiratkozás-naplója.
-- Lásd lib/brevo.ts és app/api/marketing/send-campaign/route.ts.
-- =====================================================================
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  html_content text not null,
  created_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

drop policy if exists "anon full access" on public.email_templates;
drop policy if exists "authenticated full access" on public.email_templates;
create policy "authenticated full access" on public.email_templates for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Jövőbeli, közvetlen feliratkozások (nem az Igényfelmérés/landing_responses
-- egyszeri email mezője — az a demand-test lista, ez itt egy önálló
-- hírlevél-lista, saját leiratkozás-állapottal).
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed boolean not null default false
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "anon full access" on public.newsletter_subscribers;
drop policy if exists "authenticated full access" on public.newsletter_subscribers;
create policy "authenticated full access" on public.newsletter_subscribers for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Globális leiratkozás-napló — a demand-test feliratkozóknak (landing_
-- responses) nincs saját "unsubscribed" mezőjük (egyszeri felmérés-
-- válasz, nem előfizetés), úgyhogy a leiratkozás-link innen tiltja le
-- az email címet minden jövőbeli kampányból, a forrásától függetlenül.
-- Az unsubscribe route ide is ír, és a newsletter_subscribers.unsubscribed
-- mezőt is frissíti, ha van egyező sor.
create table if not exists public.email_unsubscribes (
  email text primary key,
  unsubscribed_at timestamptz not null default now()
);

alter table public.email_unsubscribes enable row level security;

drop policy if exists "anon full access" on public.email_unsubscribes;
drop policy if exists "authenticated full access" on public.email_unsubscribes;
create policy "authenticated full access" on public.email_unsubscribes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Storage — bucket a sablon-feltöltéskor csatolt logóhoz (a mentés a
-- feltöltött kép URL-jével cseréli le a sablon HTML-jében szereplő
-- YOUR_LOGO_URL helyőrzőt).
insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do nothing;

drop policy if exists "email-assets bucket anon read" on storage.objects;
drop policy if exists "email-assets bucket authenticated read" on storage.objects;
create policy "email-assets bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'email-assets' and auth.uid() is not null);

drop policy if exists "email-assets bucket anon write" on storage.objects;
drop policy if exists "email-assets bucket authenticated write" on storage.objects;
create policy "email-assets bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'email-assets' and auth.uid() is not null);

-- =====================================================================
-- Kiadások (Pénzügyek) — operating costs (hosting/tools, Treuhand,
-- marketing spend, csomagolás/szállítás, …), independent of a product's
-- COGS. is_recurring rows represent an ongoing monthly commitment (the
-- break-even calculator normalizes recurrence_type down to a monthly
-- figure — see lib/finance.ts); one-off rows are just a dated
-- transaction. Reuses the same Napi/Heti/Havi/Negyedéves/Éves
-- recurrence_type vocabulary as task_templates (no separate enum) even
-- though Havi/Negyedéves/Éves are the realistic ones for a cost line.
-- =====================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Egyéb',
  amount numeric(12, 2) not null,
  currency text not null default 'CHF' check (currency in ('CHF', 'USD', 'EUR')),
  expense_date date not null default current_date,
  is_recurring boolean not null default false,
  recurrence_type text check (recurrence_type in ('Napi', 'Heti', 'Havi', 'Negyedéves', 'Éves')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists "anon full access" on public.expenses;
drop policy if exists "authenticated full access" on public.expenses;
create policy "authenticated full access" on public.expenses for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.expenses;
create trigger set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- Pénzügyek & Számvitel bővítés — a Kiadások sor mostantól explicit Fix/
-- Változó típusú (a Fix/Változó költségek fülek ez alapján szűrnek, nem
-- is_recurring alapján — az továbbra is csak a fedezeti pont havi
-- normalizálásához kell, lásd lib/finance.ts). `name` átnevezve
-- `description`-re, hogy a mezőnév a valódi tartalmát tükrözze (pl.
-- "Claude AI előfizetés") — a `do $$ ... $$` blokk ugyanaz a
-- rename-guard minta, mint a tasks.campaign_id -> campaign_label
-- átnevezésnél fentebb, így csak egyszer fut le.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'name'
  ) then
    alter table public.expenses rename column name to description;
  end if;
end $$;

-- Nincs automatikus Fix/Változó besorolás a meglévő sorokra (pl.
-- is_recurring -> 'Fix költség') — egy induló vállalkozásnál ez pár
-- sort jelent, egyszerűbb és biztonságosabb kézzel átsorolni az új
-- inline-szerkesztéssel, mint egy újrafuttatáskor mindig felülíró
-- automatikus szabályt fenntartani.
alter table public.expenses add column if not exists type text not null default 'Változó költség'
  check (type in ('Fix költség', 'Változó költség'));
alter table public.expenses add column if not exists payment_method text;
alter table public.expenses add column if not exists notes text;
-- A nyugta/számla képe/PDF-je a private 'receipts' Storage bucketben —
-- lásd lib/signed-storage-url.ts, ugyanaz az aláírt-link minta, mint a
-- többi founder-only bucketnél.
alter table public.expenses add column if not exists receipt_url text;
alter table public.expenses add column if not exists related_supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.expenses add column if not exists related_product_id uuid references public.products(id) on delete set null;

-- Storage — bucket a kiadásokhoz csatolt nyugták/számlák képéhez/PDF-jéhez.
-- Privát a létrehozásától fogva (nem kellett előbb public: true-nak
-- lennie, mint a korábbi bucketeknek — lásd a lenti biztonsági jegyzetet
-- a README-ben).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts bucket authenticated read" on storage.objects;
create policy "receipts bucket authenticated read"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid() is not null);

drop policy if exists "receipts bucket authenticated write" on storage.objects;
create policy "receipts bucket authenticated write"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid() is not null);

drop policy if exists "receipts bucket authenticated update" on storage.objects;
create policy "receipts bucket authenticated update"
  on storage.objects for update
  using (bucket_id = 'receipts' and auth.uid() is not null);

drop policy if exists "receipts bucket authenticated delete" on storage.objects;
create policy "receipts bucket authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid() is not null);

-- =====================================================================
-- Bevételek (Pénzügyek → Bevételek) — explicitly logged revenue rows,
-- independent of the Megrendelések-based "Tényleges bevétel" summary
-- and the Termékek-based tervezési kalkulátor on Áttekintés (those stay
-- as they were). invoice_id is set only when a row was auto-created by
-- issuing a Számlázás QR-számla — see the invoices table further down —
-- and status then mirrors that invoice's Kiállítva/Kifizetve state;
-- a manually-logged revenue row (not from an invoice) leaves both null.
-- =====================================================================
create table if not exists public.revenue (
  id uuid primary key default gen_random_uuid(),
  revenue_date date not null default current_date,
  amount numeric(12, 2) not null,
  currency text not null default 'CHF' check (currency in ('CHF', 'USD', 'EUR')),
  source text not null,
  related_product_id uuid references public.products(id) on delete set null,
  notes text,
  status text check (status in ('Kiállítva', 'Kifizetve')),
  invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.revenue enable row level security;

drop policy if exists "authenticated full access" on public.revenue;
create policy "authenticated full access" on public.revenue for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.revenue;
create trigger set_updated_at before update on public.revenue
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Költségvetés (Pénzügyek → Költségvetés) — one planned_amount per
-- category per period. `month`/`quarter` are only meaningful for their
-- matching `period` (Havi -> month 1-12, Negyedéves -> quarter 1-4,
-- Éves -> neither) — enforced app-side (the Költségvetés form only
-- shows the field that applies), not with a check constraint, since
-- expressing "exactly one of two columns is null depending on a third
-- column's value" cleanly in SQL isn't worth the extra rigidity here.
-- Same free-text category vocabulary as expenses.category (not a shared
-- FK/enum — a budget line can exist before any expense in that category
-- does).
-- =====================================================================
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  period text not null check (period in ('Havi', 'Negyedéves', 'Éves')),
  year integer not null,
  month integer check (month between 1 and 12),
  quarter integer check (quarter between 1 and 4),
  planned_amount numeric(12, 2) not null,
  currency text not null default 'CHF' check (currency in ('CHF', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

drop policy if exists "authenticated full access" on public.budgets;
create policy "authenticated full access" on public.budgets for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.budgets;
create trigger set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Számlázás (Pénzügyek → Számlázás) — svájci QR-számla (QR-Rechnung).
-- invoice_number is generated app-side ("<év>-<sorszám>", e.g.
-- "2026-001") at creation, not by a DB sequence, so a Piszkozat that
-- never gets kiállítva doesn't burn a number out of order — simple
-- enough for the realistic volume here (one founder, occasional
-- invoices). invoice_items is a separate table (not a jsonb column)
-- so each line's mennyiség/egységár stays a real numeric, queryable if
-- this ever needs a per-line report.
-- =====================================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_name text not null,
  customer_address text,
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'CHF' check (currency in ('CHF', 'USD', 'EUR')),
  status text not null default 'Piszkozat' check (status in ('Piszkozat', 'Kiállítva', 'Kifizetve')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

drop policy if exists "authenticated full access" on public.invoices;
create policy "authenticated full access" on public.invoices for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.invoices;
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- Added now that invoices exists — the FK on revenue.invoice_id from
-- earlier in this file couldn't reference it yet at that point.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'revenue' and constraint_name = 'revenue_invoice_id_fkey'
  ) then
    alter table public.revenue
      add constraint revenue_invoice_id_fkey foreign key (invoice_id) references public.invoices(id) on delete set null;
  end if;
end $$;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invoice_items enable row level security;

drop policy if exists "authenticated full access" on public.invoice_items;
create policy "authenticated full access" on public.invoice_items for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- QR-számla kiállító (creditor) adatai — a company_settings singleton
-- soron, a Márka-adatok mellett, mert ugyanaz a "cégadat" fogalomkör.
-- Külön mezők (nem az already-meglévő szabad szöveges `address`), mert
-- a swissqrbill csomag strukturált utca/irányítószám/város/ország
-- mezőket vár, nem egy egyben beírt címet.
alter table public.company_settings add column if not exists iban text;
alter table public.company_settings add column if not exists billing_street text;
alter table public.company_settings add column if not exists billing_zip text;
alter table public.company_settings add column if not exists billing_city text;
alter table public.company_settings add column if not exists billing_country text not null default 'CH';

-- Pénzügyek → Cash Flow "Jelenlegi bankegyenleg" — kézzel frissített
-- kiindulópont a havi projekcióhoz (lásd lib/finance-budget.ts
-- buildCashFlowProjection), mindig a company_settings.currency
-- pénznemében értendő, ugyanúgy mint minden más összesítő nézet.
alter table public.company_settings add column if not exists bank_balance numeric(14, 2);

-- Pénzügyek → ÁFA/MWST — csak a küszöb-mérőhöz (lásd
-- lib/finance-budget.ts vatThresholdProgress) kell revenue-t olvasni,
-- azon már nincs mit tárolni. vat_registered egyetlen kapcsoló: ha be
-- van kapcsolva, a fül megmutatja a negyedéves beszedett/fizetett ÁFA
-- rögzítő mezőket is (vat_returns) — ez még nem küld semmit sehova,
-- csak előkészíti a jövőbeli, tényleges bevallás-funkciót.
alter table public.company_settings add column if not exists vat_registered boolean not null default false;

create table if not exists public.vat_returns (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  quarter integer not null check (quarter between 1 and 4),
  collected_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  currency text not null default 'CHF' check (currency in ('CHF', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, quarter)
);

alter table public.vat_returns enable row level security;

drop policy if exists "authenticated full access" on public.vat_returns;
create policy "authenticated full access" on public.vat_returns for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.vat_returns;
create trigger set_updated_at before update on public.vat_returns
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Kampányok — named marketing pushes (e.g. "ZUSAMMEN FIRST 20"),
-- distinct from marketing_campaigns above (the 4 fixed Évszakos
-- stratégia rows, one per season, seeded once and never really
-- "created" by the founder). A kampány optionally belongs to a season
-- (same season-text FK pattern as marketing_content.season) and groups
-- together the Feladatok and Marketing tartalom that serve it — see the
-- Kampány részletes nézet on both Marketing and Feladatok. Placed this
-- late in the file since it needs marketing_campaigns (for the season
-- FK) and is itself referenced by the tasks/marketing_content columns
-- added right below — both already exist by this point in the file.
-- =====================================================================
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text references public.marketing_campaigns(season) on delete set null,
  status text not null default 'Tervezve' check (status in ('Tervezve', 'Aktív', 'Lezárva')),
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

drop policy if exists "anon full access" on public.campaigns;
drop policy if exists "authenticated full access" on public.campaigns;
create policy "authenticated full access" on public.campaigns for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.campaigns;
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- tasks.campaign_id used to be free text (see the Típus dimension
-- comment further up) — renamed to campaign_label to preserve whatever
-- was already typed there as a legacy display fallback, and replaced
-- with a real FK into campaigns above. Guarded so this rename only ever
-- fires once: after it runs, campaign_id is the new uuid column, so the
-- data_type check below is false on every subsequent run of this file.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
      and column_name = 'campaign_id' and data_type = 'text'
  ) then
    alter table public.tasks rename column campaign_id to campaign_label;
  end if;
end $$;

alter table public.tasks add column if not exists campaign_label text;
alter table public.tasks add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- Optional link from a Tartalom-naptár item to the kampány it serves —
-- shown on that kampány's részletes nézet alongside its Feladatok (and,
-- via the content's own asset_id, its Marketing anyagok).
alter table public.marketing_content add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- Seed the founder's first real kampány. The 4 already-entered First20
-- Kampány-feladatok need linking to it by hand afterwards, from the
-- Feladatok oldal's "Melyik kampányhoz tartozik?" picker — this script
-- has no reliable way to match existing tasks by title.
insert into public.campaigns (name, season, status)
select 'ZUSAMMEN FIRST 20', 'Autumn', 'Tervezve'
where not exists (select 1 from public.campaigns where name = 'ZUSAMMEN FIRST 20');

-- =====================================================================
-- Fiókok & Szolgáltatások (Beállítások → Fiókok & Szolgáltatások) — a
-- metadata-only overview of third-party services the business uses:
-- which email a service is registered under, what it's for, when it
-- renews. Deliberately NOT a credentials store — there is no password
-- column here or anywhere in the UI, not even encrypted.
-- password_manager_note is a fixed display string ("Jelszó a
-- Bitwardenben tárolva"), the same on every row, pointing the founder
-- at the real password manager instead of tempting a "just this once"
-- plaintext/encrypted entry here.
-- =====================================================================
create table if not exists public.service_accounts (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  account_email text,
  purpose text,
  renewal_date date,
  renewal_cost numeric(12, 2),
  renewal_currency text check (renewal_currency in ('CHF', 'USD', 'EUR')),
  notes text,
  password_manager_note text not null default 'Jelszó a Bitwardenben tárolva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_accounts enable row level security;

drop policy if exists "authenticated full access" on public.service_accounts;
create policy "authenticated full access" on public.service_accounts for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on public.service_accounts;
create trigger set_updated_at before update on public.service_accounts
  for each row execute function public.set_updated_at();

-- Seed the founder's initial services/accounts — idempotent by
-- service_name (same pattern as the campaigns seed above), safe to
-- re-run this file without duplicating rows. The last row's shape
-- differs from the others: it describes the brand email alias itself
-- (connect@das-zusammen.ch) rather than a third-party service, so it
-- has no separate registration email of its own.
insert into public.service_accounts (service_name, account_email, purpose, renewal_date)
select 'Infomaniak', 'zusammen.swiss@gmail.com', 'Domain (das-zusammen.ch) + email hoszting', '2027-09-18'
where not exists (select 1 from public.service_accounts where service_name = 'Infomaniak');

insert into public.service_accounts (service_name, account_email, purpose)
select 'Brevo', 'zusammen.swiss@gmail.com', 'Email-kampányok küldése'
where not exists (select 1 from public.service_accounts where service_name = 'Brevo');

insert into public.service_accounts (service_name, account_email, purpose)
select 'Vercel', 'zusammen.swiss@gmail.com', 'Hosting, Dashboard + landing oldal'
where not exists (select 1 from public.service_accounts where service_name = 'Vercel');

insert into public.service_accounts (service_name, account_email, purpose)
select 'Supabase', 'zusammen.swiss@gmail.com', 'Adatbázis'
where not exists (select 1 from public.service_accounts where service_name = 'Supabase');

insert into public.service_accounts (service_name, account_email, purpose)
select 'QPMN', 'zusammen.swiss@gmail.com', 'Kártyagyártó'
where not exists (select 1 from public.service_accounts where service_name = 'QPMN');

insert into public.service_accounts (service_name, account_email, purpose)
select 'connect@das-zusammen.ch', null, 'Márka email-cím, Infomaniakon keresztül'
where not exists (select 1 from public.service_accounts where service_name = 'connect@das-zusammen.ch');

-- =====================================================================
-- "Rögzítés lezárása" — Pénzügyek → Fix/Változó költségek és Bevételek.
-- Once a founder marks an expense/revenue row locked, its amount/date/
-- category become read-only in the UI (components/finance/
-- LockControls.tsx) until explicitly unlocked again — every unlock is
-- logged in unlock_history (never overwritten, only appended to), so an
-- accountant can trust a locked-and-never-unlocked row was never
-- touched after the fact. locked_at is the most recent lock time (reset
-- on every re-lock); unlock_history is independent of it and keeps
-- accumulating across every lock/unlock cycle a row goes through.
-- =====================================================================
alter table public.expenses add column if not exists is_locked boolean not null default false;
alter table public.expenses add column if not exists locked_at timestamptz;
alter table public.expenses add column if not exists unlock_history jsonb not null default '[]'::jsonb;

alter table public.revenue add column if not exists is_locked boolean not null default false;
alter table public.revenue add column if not exists locked_at timestamptz;
alter table public.revenue add column if not exists unlock_history jsonb not null default '[]'::jsonb;
