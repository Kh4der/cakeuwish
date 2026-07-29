-- Phase 3: orders — inquiries Parul has confirmed, tracked through pickup.
-- Run this in the Supabase SQL editor AFTER 0001 + 0002 (safe to re-run).

create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid references public.inquiries(id) on delete set null,
  name         text not null default '',
  phone        text not null default '',
  email        text not null default '',
  event_date   date,
  pickup_date  date,
  pickup_slot  text not null default '',
  description  text not null default '',
  price        numeric(8,2),
  deposit_paid boolean not null default false,
  status       text not null default 'pending', -- pending | confirmed | ready | completed | cancelled
  admin_notes  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- One order per inquiry — makes "Convert to order" idempotent across reloads
-- (manual orders with no inquiry stay unlimited).
create unique index if not exists orders_inquiry_id_uniq
  on public.orders (inquiry_id) where inquiry_id is not null;

-- Orders are private business records: signed-in admins only, no anon access.
alter table public.orders enable row level security;

drop policy if exists "orders admin all" on public.orders;
create policy "orders admin all" on public.orders
  for all to authenticated using (true) with check (true);
