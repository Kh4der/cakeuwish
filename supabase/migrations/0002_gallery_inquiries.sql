-- Phase 1: richer cake metadata + customer quote/contact inquiries.
-- Run this in the Supabase SQL editor AFTER 0001_init.sql (safe to re-run).

-- ──────────────────── cakes: gallery metadata ────────────────────
alter table public.cakes add column if not exists flavor       text   not null default '';
alter table public.cakes add column if not exists servings     text   not null default '';
alter table public.cakes add column if not exists tags         text[] not null default '{}';
alter table public.cakes add column if not exists extra_images text[] not null default '{}';

-- Backfill tags for the originally-seeded cakes (only where still empty),
-- matching the site's bundled seed content.
update public.cakes set tags = array['kids birthday','farm animals','barnyard','5th birthday'] where id = '5d2ec516-28dc-4e17-8801-5391e8a2f0c8' and tags = '{}';
update public.cakes set tags = array['birthday','ballet','pink ruffles','designer']            where id = '25e166a0-4076-4378-91d2-fd62b1890e46' and tags = '{}';
update public.cakes set tags = array['50th anniversary','gold lace','roses','indian']          where id = 'a99e9e06-dbb2-4bde-8d13-f33521d03dfb' and tags = '{}';
update public.cakes set tags = array['milestone birthday','geode','black fondant','rose gold'] where id = 'ba90402b-d98e-4f7d-ab25-53200a10595b' and tags = '{}';
update public.cakes set tags = array['wedding','indian wedding','lehenga','figurines']         where id = 'e135e65c-bac5-40fa-9acd-1dd74cc189ca' and tags = '{}';
update public.cakes set tags = array['wedding','buttercream','garden roses','classic']         where id = '6a8115e3-88ee-4506-bda0-a6f4e7ec579c' and tags = '{}';
update public.cakes set tags = array['military','marine corps','retirement','tribute']         where id = '8bf75c40-ca3c-4686-8f3c-70ff4bf73a6c' and tags = '{}';

-- ──────────────────────── inquiries ──────────────────────────────
-- Quote requests + contact-form messages submitted by visitors.
create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'quote',   -- 'quote' | 'contact'
  name        text not null default '',
  phone       text not null default '',
  email       text not null default '',
  event_date  date,
  pickup_date date,
  occasion    text not null default '',
  theme       text not null default '',
  servings    text not null default '',
  flavor      text not null default '',
  budget      text not null default '',
  dietary     text not null default '',
  message     text not null default '',
  cake_id     uuid,                            -- optional "like this cake" reference
  cake_title  text not null default '',
  photos      text[] not null default '{}',    -- inspiration image URLs
  status      text not null default 'new',     -- new | quoted | confirmed | closed
  admin_notes text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

alter table public.inquiries enable row level security;

-- Visitors may CREATE inquiries (always born as 'new', no admin fields), never read them.
drop policy if exists "inquiries public insert" on public.inquiries;
drop policy if exists "inquiries admin all"     on public.inquiries;
create policy "inquiries public insert" on public.inquiries
  for insert to anon with check (status = 'new' and admin_notes = '');
create policy "inquiries admin all" on public.inquiries
  for all to authenticated using (true) with check (true);

-- ───────────────── storage: inspiration photos ───────────────────
-- Visitors upload inspiration images with their quote request. Public-read
-- bucket (admin views them by URL); uploads capped to images ≤ 8 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('inspiration', 'inspiration', true, 8388608, array['image/webp','image/jpeg','image/png'])
  on conflict (id) do nothing;

drop policy if exists "public upload inspiration" on storage.objects;
drop policy if exists "admin manage inspiration"  on storage.objects;
create policy "public upload inspiration" on storage.objects
  for insert to anon with check (bucket_id = 'inspiration');
create policy "admin manage inspiration" on storage.objects
  for delete to authenticated using (bucket_id = 'inspiration');
