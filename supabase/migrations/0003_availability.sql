-- Phase 2: availability calendar — blocked dates + shop booking settings.
-- Run this in the Supabase SQL editor AFTER 0002_gallery_inquiries.sql (safe to re-run).

-- ──────────────────────── blocked dates ──────────────────────────
-- Days Parul cannot take orders (fully booked, travel, holidays).
create table if not exists public.blocked_dates (
  day    date primary key,
  reason text not null default ''
);

-- ──────────────────────── shop settings ──────────────────────────
-- Single-row table (id is constrained to 1) with the booking knobs.
create table if not exists public.shop_settings (
  id                 smallint primary key default 1 check (id = 1),
  max_orders_per_day int    not null default 3,
  min_lead_days      int    not null default 7,
  pickup_slots       text[] not null default array['10:00 AM – 12:00 PM','2:00 PM – 4:00 PM','5:00 PM – 7:00 PM'],
  vacation_note      text   not null default ''
);

insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- Quote requests can now carry a preferred pickup window.
alter table public.inquiries add column if not exists pickup_slot text not null default '';

-- ─────────────────── row level security ───────────────────
-- Visitors READ availability (the quote form needs it); only admins write.
alter table public.blocked_dates enable row level security;
alter table public.shop_settings enable row level security;

drop policy if exists "blocked_dates public read" on public.blocked_dates;
drop policy if exists "blocked_dates admin all"   on public.blocked_dates;
create policy "blocked_dates public read" on public.blocked_dates
  for select to anon using (true);
create policy "blocked_dates admin all" on public.blocked_dates
  for all to authenticated using (true) with check (true);

-- Column-level guard: visitors may see WHICH days are blocked, never WHY —
-- the reason field is private admin text (family events, travel, …).
revoke select on public.blocked_dates from anon;
grant select (day) on public.blocked_dates to anon;

drop policy if exists "shop_settings public read" on public.shop_settings;
drop policy if exists "shop_settings admin all"   on public.shop_settings;
create policy "shop_settings public read" on public.shop_settings
  for select to anon using (true);
create policy "shop_settings admin all" on public.shop_settings
  for all to authenticated using (true) with check (true);
