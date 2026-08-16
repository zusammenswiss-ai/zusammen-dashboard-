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
  contacted boolean not null default false,
  reply_received boolean not null default false,
  notes text,
  email_text text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial launch — safe no-op if the column already exists.
alter table public.suppliers add column if not exists contact_email text;

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
  delivery_date date,
  status text not null default 'New' check (status in ('New', 'Processing', 'Shipped', 'Done')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial launch — safe no-op if the column already exists.
alter table public.orders add column if not exists customer_email text;

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
