-- CakeUWish admin backend — schema, security, and storage.
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query), then run seed.sql.

-- ───────────────────────── tables ─────────────────────────
create table if not exists public.cakes (
  id          uuid primary key default gen_random_uuid(),
  title       text    not null default '',
  blurb       text    not null default '',
  category    text    not null default '',
  bg          text    not null default '#F3EDE1',
  panel       text    not null default '#F1EDE8',
  accent      text    not null default '#A16207',
  dark        boolean not null default false,
  image       text    not null default '',
  sort_order  int     not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.showcase_photos (
  id          uuid primary key default gen_random_uuid(),
  src         text    not null default '',
  alt         text    not null default '',
  sort_order  int     not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- keep updated_at fresh on cake edits
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cakes_set_updated_at on public.cakes;
create trigger cakes_set_updated_at
  before update on public.cakes
  for each row execute function public.set_updated_at();

-- ─────────────────── row level security ───────────────────
-- Public (anonymous) visitors can READ only visible rows.
-- Signed-in admins can do everything (incl. see hidden rows).
alter table public.cakes            enable row level security;
alter table public.showcase_photos  enable row level security;

drop policy if exists "cakes public read"  on public.cakes;
drop policy if exists "cakes admin all"     on public.cakes;
create policy "cakes public read" on public.cakes
  for select to anon using (visible = true);
create policy "cakes admin all" on public.cakes
  for all to authenticated using (true) with check (true);

drop policy if exists "showcase public read" on public.showcase_photos;
drop policy if exists "showcase admin all"    on public.showcase_photos;
create policy "showcase public read" on public.showcase_photos
  for select to anon using (visible = true);
create policy "showcase admin all" on public.showcase_photos
  for all to authenticated using (true) with check (true);

-- ───────────────────────── storage ────────────────────────
-- Public buckets: anyone can read images (the site needs that); only signed-in
-- admins can upload / replace / delete.
insert into storage.buckets (id, name, public) values ('cakes', 'cakes', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('showcase', 'showcase', true)
  on conflict (id) do nothing;

drop policy if exists "admin upload cakes"   on storage.objects;
drop policy if exists "admin update cakes"   on storage.objects;
drop policy if exists "admin delete cakes"   on storage.objects;
create policy "admin upload cakes" on storage.objects
  for insert to authenticated with check (bucket_id in ('cakes', 'showcase'));
create policy "admin update cakes" on storage.objects
  for update to authenticated using (bucket_id in ('cakes', 'showcase'));
create policy "admin delete cakes" on storage.objects
  for delete to authenticated using (bucket_id in ('cakes', 'showcase'));
