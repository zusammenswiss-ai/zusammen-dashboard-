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
create policy "anon full access" on public.task_templates for all using (true) with check (true);

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
-- This app is a single-user personal dashboard with no login screen —
-- it talks to Supabase using the public "anon" key directly from the
-- browser. We enable RLS (best practice) and add permissive policies so
-- the anon key can read/write every table. Real protection comes from
-- keeping the dashboard URL private, or turning on the optional Basic
-- Auth in middleware.ts (see README). If you ever add multiple users,
-- replace these policies with ones scoped to auth.uid().
-- =====================================================================
alter table public.suppliers enable row level security;
alter table public.tasks enable row level security;
alter table public.finance_products enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.documents enable row level security;
alter table public.future_plans enable row level security;
alter table public.orders enable row level security;

drop policy if exists "anon full access" on public.suppliers;
create policy "anon full access" on public.suppliers for all using (true) with check (true);

drop policy if exists "anon full access" on public.tasks;
create policy "anon full access" on public.tasks for all using (true) with check (true);

drop policy if exists "anon full access" on public.finance_products;
create policy "anon full access" on public.finance_products for all using (true) with check (true);

drop policy if exists "anon full access" on public.marketing_campaigns;
create policy "anon full access" on public.marketing_campaigns for all using (true) with check (true);

drop policy if exists "anon full access" on public.documents;
create policy "anon full access" on public.documents for all using (true) with check (true);

drop policy if exists "anon full access" on public.future_plans;
create policy "anon full access" on public.future_plans for all using (true) with check (true);

drop policy if exists "anon full access" on public.orders;
create policy "anon full access" on public.orders for all using (true) with check (true);

-- =====================================================================
-- Storage — bucket for uploaded documents
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "documents bucket anon read" on storage.objects;
create policy "documents bucket anon read"
  on storage.objects for select
  using (bucket_id = 'documents');

drop policy if exists "documents bucket anon write" on storage.objects;
create policy "documents bucket anon write"
  on storage.objects for insert
  with check (bucket_id = 'documents');

drop policy if exists "documents bucket anon update" on storage.objects;
create policy "documents bucket anon update"
  on storage.objects for update
  using (bucket_id = 'documents');

drop policy if exists "documents bucket anon delete" on storage.objects;
create policy "documents bucket anon delete"
  on storage.objects for delete
  using (bucket_id = 'documents');

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
create policy "anon full access" on public.card_assets for all using (true) with check (true);

-- Storage — bucket for the uploaded card-asset ZIP files
insert into storage.buckets (id, name, public)
values ('card-assets', 'card-assets', true)
on conflict (id) do nothing;

drop policy if exists "card-assets bucket anon read" on storage.objects;
create policy "card-assets bucket anon read"
  on storage.objects for select
  using (bucket_id = 'card-assets');

drop policy if exists "card-assets bucket anon write" on storage.objects;
create policy "card-assets bucket anon write"
  on storage.objects for insert
  with check (bucket_id = 'card-assets');

drop policy if exists "card-assets bucket anon update" on storage.objects;
create policy "card-assets bucket anon update"
  on storage.objects for update
  using (bucket_id = 'card-assets');

drop policy if exists "card-assets bucket anon delete" on storage.objects;
create policy "card-assets bucket anon delete"
  on storage.objects for delete
  using (bucket_id = 'card-assets');

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
create policy "anon full access" on public.price_quotes for all using (true) with check (true);

-- Storage — bucket for uploaded price-quote screenshots
insert into storage.buckets (id, name, public)
values ('price-quotes', 'price-quotes', true)
on conflict (id) do nothing;

drop policy if exists "price-quotes bucket anon read" on storage.objects;
create policy "price-quotes bucket anon read"
  on storage.objects for select
  using (bucket_id = 'price-quotes');

drop policy if exists "price-quotes bucket anon write" on storage.objects;
create policy "price-quotes bucket anon write"
  on storage.objects for insert
  with check (bucket_id = 'price-quotes');

drop policy if exists "price-quotes bucket anon update" on storage.objects;
create policy "price-quotes bucket anon update"
  on storage.objects for update
  using (bucket_id = 'price-quotes');

drop policy if exists "price-quotes bucket anon delete" on storage.objects;
create policy "price-quotes bucket anon delete"
  on storage.objects for delete
  using (bucket_id = 'price-quotes');

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
create policy "anon full access" on public.marketing_content for all using (true) with check (true);

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
create policy "anon full access" on public.marketing_assets for all using (true) with check (true);

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

drop policy if exists "marketing bucket anon read" on storage.objects;
create policy "marketing bucket anon read"
  on storage.objects for select
  using (bucket_id = 'marketing');

drop policy if exists "marketing bucket anon write" on storage.objects;
create policy "marketing bucket anon write"
  on storage.objects for insert
  with check (bucket_id = 'marketing');

drop policy if exists "marketing bucket anon update" on storage.objects;
create policy "marketing bucket anon update"
  on storage.objects for update
  using (bucket_id = 'marketing');

drop policy if exists "marketing bucket anon delete" on storage.objects;
create policy "marketing bucket anon delete"
  on storage.objects for delete
  using (bucket_id = 'marketing');

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
-- Unlike the rest of this schema, these two tables are written to by
-- anonymous site visitors (not just the founder), and the "founder view"
-- on /landing reads aggregate stats back out using the same anon key.
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
create policy "anon full access" on public.landing_letters for all using (true) with check (true);

drop policy if exists "anon full access" on public.landing_responses;
create policy "anon full access" on public.landing_responses for all using (true) with check (true);

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
