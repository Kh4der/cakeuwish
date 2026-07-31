-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE DATABASE SETUP — one paste for a fresh Supabase project.
-- Generated from migrations 0001–0012 (all idempotent; safe to re-run).
--
-- 1. Supabase Dashboard → SQL Editor → New query → paste this file → Run.
-- 2. Optionally run seed.sql after (demo content: 7 cakes + 23 photos).
-- 3. Create the admin login: Authentication → Users → Add user (auto-confirm).
-- 4. Email webhook: see the commented template at the very END of this file.
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══ 0001_init.sql ═══
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


-- ═══ 0002_gallery_inquiries.sql ═══
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


-- ═══ 0003_availability.sql ═══
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


-- ═══ 0004_orders.sql ═══
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


-- ═══ 0005_kb.sql ═══
-- AI assistant knowledge base — admin-editable facts appended to the chat
-- assistant's knowledge document (seasonal specials, current lead times, etc.).
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

create table if not exists public.kb_entries (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  content    text not null default '',
  visible    boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table public.kb_entries enable row level security;

-- Anyone (incl. the /api/chat function using the anon key) may READ visible
-- entries; only signed-in admins can write.
drop policy if exists "kb public read" on public.kb_entries;
drop policy if exists "kb admin all"   on public.kb_entries;
create policy "kb public read" on public.kb_entries
  for select to anon using (visible = true);
create policy "kb admin all" on public.kb_entries
  for all to authenticated using (true) with check (true);


-- ═══ 0006_pricing_video.sql ═══
-- Admin-controlled pricing + video support for the showcase wall.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run —
-- the price seed only fires on an empty table, so admin edits are never lost).

-- ──────────────────────── pricing ────────────────────────────────
create table if not exists public.pricing_items (
  id         uuid primary key default gen_random_uuid(),
  section    text not null default 'starting' check (section in ('starting', 'addon')),
  item       text not null default '',
  detail     text not null default '',
  price      text,                       -- e.g. 'From $95' — null renders "Request a quote"
  sort_order int  not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists pricing_set_updated_at on public.pricing_items;
create trigger pricing_set_updated_at
  before update on public.pricing_items
  for each row execute function public.set_updated_at();

alter table public.pricing_items enable row level security;

drop policy if exists "pricing public read" on public.pricing_items;
drop policy if exists "pricing admin all"   on public.pricing_items;
create policy "pricing public read" on public.pricing_items
  for select to anon using (visible = true);
create policy "pricing admin all" on public.pricing_items
  for all to authenticated using (true) with check (true);

-- Starting-point prices (editable in Admin → Pricing). Seeded only when empty.
insert into public.pricing_items (section, item, detail, price, sort_order)
select * from (values
  ('starting', 'Single-tier custom cakes',    'One tier, fully custom design — most birthdays and small parties.',        'From $95',        0),
  ('starting', 'Two-tier celebration cakes',  'Bigger centerpiece for milestones, showers, and larger parties.',          'From $185',       1),
  ('starting', 'Wedding & multi-tier cakes',  'Three or more tiers, delivery & setup available.',                         'From $325',       2),
  ('starting', 'Sculpted & novelty cakes',    'Shaped cakes — purses, characters, cars, anything you can dream up.',      'From $165',       3),
  ('starting', 'Cupcakes & cake pops',        'By the dozen — great alongside a cake when the guest list grows.',         'From $35 / dozen', 4),
  ('addon',    'Custom cake toppers',         'Names, numbers, figurines, and acrylic toppers.',                          'From $15',        0),
  ('addon',    'Hand-sculpted figures',       'Edible characters and keepsake figurines.',                                'From $30',        1),
  ('addon',    'Matching cupcakes',           'Extend servings without changing the centerpiece.',                        'From $35 / dozen', 2),
  ('addon',    'Delivery & setup',            'To your venue, with CakeUWish handling transport liability.',              'From $35',        3)
) as seed(section, item, detail, price, sort_order)
where not exists (select 1 from public.pricing_items);

-- ─────────────────── showcase: video support ─────────────────────
alter table public.showcase_photos
  add column if not exists media_type text not null default 'image'
  check (media_type in ('image', 'video'));


-- ═══ 0007_callbacks_booking.sql ═══
-- Callback requests + real capacity-aware booking.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

-- Callback requests ride the inquiries pipeline (kind = 'callback') with a
-- preferred time window.
alter table public.inquiries add column if not exists preferred_time text not null default '';

-- Public capacity feed: date + booking count ONLY (no customer data). Lets the
-- quote form and the AI assistant refuse days that are already full, without
-- giving anon any access to the orders table itself.
create or replace function public.date_load()
returns table(day date, cnt bigint)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(pickup_date, event_date) as day, count(*) as cnt
  from public.orders
  where status in ('pending', 'confirmed', 'ready')
    and coalesce(pickup_date, event_date) >= current_date
  group by 1
$$;

revoke all on function public.date_load() from public;
grant execute on function public.date_load() to anon, authenticated;


-- ═══ 0008_vendor_payments.sql ═══
-- Vendor / expense ledger for the admin Overview page.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

create table if not exists public.vendor_payments (
  id         uuid primary key default gen_random_uuid(),
  paid_on    date not null default current_date,
  vendor     text not null default '',
  category   text not null default '',   -- Ingredients | Packaging | Equipment | Marketing | Other
  amount     numeric(10,2) not null default 0,
  method     text not null default '',   -- Cash | Zelle | PayPal | Card | Other
  note       text not null default '',
  created_at timestamptz not null default now()
);

-- Private business records — signed-in admins only, no anon access.
alter table public.vendor_payments enable row level security;

drop policy if exists "vendor_payments admin all" on public.vendor_payments;
create policy "vendor_payments admin all" on public.vendor_payments
  for all to authenticated using (true) with check (true);


-- ═══ 0009_costs_receipts.sql ═══
-- Money cockpit: API-usage cost metering + receipt photos on vendor payments.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

-- Receipt image attached to a vendor payment (private receipts bucket path).
alter table public.vendor_payments add column if not exists receipt_url text not null default '';

-- Every paid AI call (site chat, cake-builder image) logs its estimated cost.
-- Inserts come from the serverless functions using the anon key; values are
-- bounded so a malicious anon insert can only add noise, not damage.
create table if not exists public.usage_log (
  id           uuid primary key default gen_random_uuid(),
  happened_at  timestamptz not null default now(),
  service      text not null check (service in ('chat', 'image')),
  input_tokens int not null default 0 check (input_tokens between 0 and 1000000),
  output_tokens int not null default 0 check (output_tokens between 0 and 1000000),
  images       int not null default 0 check (images between 0 and 10),
  est_cost     numeric(10, 6) not null default 0 check (est_cost between 0 and 1)
);

alter table public.usage_log enable row level security;

drop policy if exists "usage anon insert" on public.usage_log;
drop policy if exists "usage admin all"   on public.usage_log;
create policy "usage anon insert" on public.usage_log
  for insert to anon with check (true);
create policy "usage admin all" on public.usage_log
  for all to authenticated using (true) with check (true);

-- Receipts are private business documents: bucket is NOT public; only
-- signed-in admins can upload and read (the UI uses signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('receipts', 'receipts', false, 8388608, array['image/webp','image/jpeg','image/png'])
  on conflict (id) do nothing;

drop policy if exists "admin upload receipts" on storage.objects;
drop policy if exists "admin read receipts"   on storage.objects;
drop policy if exists "admin delete receipts" on storage.objects;
create policy "admin upload receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts');
create policy "admin read receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');
create policy "admin delete receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts');


-- ═══ 0010_site_config.sql ═══
-- Installation panel: client settings move from code into the database, and a
-- SUPER-ADMIN (the agency) gets exclusive write access via the Setup page.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

create table if not exists public.site_config (
  id                smallint primary key default 1 check (id = 1),
  -- business identity (public — the site renders these)
  business_name     text not null default 'CakeUWish',
  legal_name        text not null default 'CakeUWish LLC',
  owner_name        text not null default 'Parul',
  city              text not null default 'Chantilly',
  region            text not null default 'VA',
  phone_e164        text not null default '+15717625848',
  phone_display     text not null default '+1 (571) 762-5848',
  whatsapp_enabled  boolean not null default false,
  facebook_url      text not null default 'https://facebook.com/CakeUWishVA',
  instagram_url     text not null default '',
  review_rating     text not null default '4.9',
  review_count      int  not null default 194,
  sociablekit_id    text not null default '25410301',
  google_place_id   text not null default '',
  -- omnichannel (public — the widget token is public by design, like our anon key)
  chatwoot_base_url text not null default '',
  chatwoot_token    text not null default '',
  -- operations (readable by anon so serverless functions can use them)
  notify_email      text not null default '',
  -- installation (admin-only)
  vapi_assistant_id text not null default '',
  super_admin_email text not null default 'admin@gmail.com',
  updated_at        timestamptz not null default now()
);

insert into public.site_config (id) values (1) on conflict (id) do nothing;

drop trigger if exists site_config_set_updated_at on public.site_config;
create trigger site_config_set_updated_at
  before update on public.site_config
  for each row execute function public.set_updated_at();

alter table public.site_config enable row level security;

drop policy if exists "config public read"      on public.site_config;
drop policy if exists "config admin read"       on public.site_config;
drop policy if exists "config superadmin write" on public.site_config;
create policy "config public read" on public.site_config
  for select to anon using (true);
create policy "config admin read" on public.site_config
  for select to authenticated using (true);
-- Only the signed-in user whose email matches super_admin_email may edit.
create policy "config superadmin write" on public.site_config
  for update to authenticated
  using ((auth.jwt() ->> 'email') = super_admin_email)
  with check ((auth.jwt() ->> 'email') = super_admin_email);

-- Column-level guard for anon: the public site + serverless functions read the
-- render/ops columns; installation columns stay admin-only.
revoke select on public.site_config from anon;
-- `id` must be granted too: anon queries filter by id=eq.1, and filtering on
-- an ungranted column is denied outright.
grant select (
  id,
  business_name, legal_name, owner_name, city, region,
  phone_e164, phone_display, whatsapp_enabled, facebook_url, instagram_url,
  review_rating, review_count, sociablekit_id, google_place_id,
  chatwoot_base_url, chatwoot_token, notify_email
) on public.site_config to anon;


-- ═══ 0011_twitter.sql ═══
-- X / Twitter: the handle joins the installation config (public info); the
-- four API secrets stay in Vercel env like every other key.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

alter table public.site_config add column if not exists twitter_handle text not null default '';

-- Column grants are additive; the id lesson from 0010 already applies.
grant select (twitter_handle) on public.site_config to anon;
notify pgrst, 'reload schema';


-- ═══ 0012_social_posts.sql ═══
-- Cross-posting: the admin composes once and the post fans out to every
-- connected network. One row per platform carries its own status, its own
-- error and its own retry, so a failing network never blocks the others.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

-- The composed post. Media already lives in the PUBLIC `showcase` bucket, so
-- Meta fetches it by URL and X streams the bytes from there — nothing is
-- re-uploaded anywhere.
create table if not exists public.social_posts (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  caption        text not null default '',
  alt_text       text not null default '',
  media_type     text not null default 'image' check (media_type in ('image', 'video')),
  -- canonical asset the website uses (webp for photos, mp4/webm/mov for video)
  media_url      text not null default '',
  -- JPEG derivative letterboxed into Instagram's 4:5–1.91:1 window. Meta
  -- rejects webp outright, so FB + IG image posts use THIS url, never media_url.
  image_jpeg_url text not null default '',
  -- optional poster frame for a video (Instagram cover_url); '' = platform picks
  cover_url      text not null default '',
  -- measured in the browser at compose time so an Instagram reel under 3s or an
  -- X video over 140s is refused before spending an API round trip
  duration_secs  numeric(7, 2) not null default 0 check (duration_secs between 0 and 100000),
  -- the showcase item this was shared from (null = composed standalone)
  showcase_id    uuid references public.showcase_photos(id) on delete set null,
  -- rollup recomputed from the target rows after every fan-out tick
  status         text not null default 'pending'
                 check (status in ('pending', 'running', 'done', 'partial', 'failed'))
);

create index if not exists social_posts_created_idx
  on public.social_posts (created_at desc);

-- Per-platform delivery. The whole resilience story lives here: each platform
-- advances its own state machine, keeps its own error text, and is retried on
-- its own. The unique constraint makes a retry an upsert, not a duplicate row.
--   pending    - queued, nothing sent yet
--   uploading  - bytes/URL handed over, no post object exists yet
--   processing - the platform is transcoding (X STATUS / IG container status)
--   posted     - live; remote_url is clickable
--   failed     - `error` explains it; this row alone can be retried
--   skipped    - platform not configured on this deployment (missing env)
--   manual     - no publishing API exists (WhatsApp); a human posts it
create table if not exists public.social_targets (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.social_posts(id) on delete cascade,
  platform     text not null check (platform in ('x', 'facebook', 'instagram', 'whatsapp')),
  status       text not null default 'pending'
               check (status in ('pending','uploading','processing','posted','failed','skipped','manual')),
  remote_id    text not null default '',
  remote_url   text not null default '',
  upload_ref   text not null default '',
  attempts     int  not null default 0 check (attempts between 0 and 20),
  error        text not null default '',
  next_poll_at timestamptz,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (post_id, platform)
);

create index if not exists social_targets_post_idx
  on public.social_targets (post_id);
create index if not exists social_targets_pending_idx
  on public.social_targets (next_poll_at)
  where status in ('pending', 'uploading', 'processing');

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at
  before update on public.social_posts
  for each row execute function public.set_updated_at();

drop trigger if exists social_targets_set_updated_at on public.social_targets;
create trigger social_targets_set_updated_at
  before update on public.social_targets
  for each row execute function public.set_updated_at();

alter table public.social_posts   enable row level security;
alter table public.social_targets enable row level security;

drop policy if exists "social posts admin all"   on public.social_posts;
drop policy if exists "social targets admin all" on public.social_targets;
create policy "social posts admin all" on public.social_posts
  for all to authenticated using (true) with check (true);
create policy "social targets admin all" on public.social_targets
  for all to authenticated using (true) with check (true);

alter table public.site_config
  add column if not exists facebook_page_name   text not null default '';
alter table public.site_config
  add column if not exists instagram_handle     text not null default '';
-- WhatsApp has no publishing API at any tier; this URL only deep-links the
-- admin to the Channel so a human can post the update by hand.
alter table public.site_config
  add column if not exists whatsapp_channel_url text not null default '';

grant select (facebook_page_name, instagram_handle, whatsapp_channel_url)
  on public.site_config to anon;

notify pgrst, 'reload schema';


-- ═══ 0013_api_costs.sql ═══
-- Itemized API spend. 0009 only metered 'chat' and 'image'; every other paid
-- service (X posts, Vapi calls, Resend emails, receipt vision) was invisible.

alter table public.usage_log drop constraint if exists usage_log_service_check;
alter table public.usage_log
  add constraint usage_log_service_check
  check (service in ('chat', 'image', 'social', 'voice', 'email', 'receipt'));

alter table public.usage_log add column if not exists detail text not null default '';
alter table public.usage_log add column if not exists quantity int not null default 1
  check (quantity between 0 and 10000);
alter table public.usage_log add column if not exists provider text not null default '';

create index if not exists usage_log_happened_idx on public.usage_log (happened_at desc);
create index if not exists usage_log_service_idx  on public.usage_log (service);

alter table public.usage_log drop constraint if exists usage_log_est_cost_check;
alter table public.usage_log
  add constraint usage_log_est_cost_check check (est_cost between 0 and 100);

notify pgrst, 'reload schema';


-- ═══ email-notification webhook (OPTIONAL — needs /api/notify deployed) ═══
-- Uncomment, replace <YOUR-DOMAIN> and <YOUR-NOTIFY-WEBHOOK-SECRET> (must
-- equal the NOTIFY_WEBHOOK_SECRET env var on Vercel), then run:
--
-- create extension if not exists pg_net;
-- create or replace function public.notify_inquiry_webhook()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   perform net.http_post(
--     url := 'https://<YOUR-DOMAIN>/api/notify?secret=<YOUR-NOTIFY-WEBHOOK-SECRET>',
--     body := jsonb_build_object('type', 'INSERT', 'table', 'inquiries', 'record', to_jsonb(new)),
--     headers := '{"Content-Type": "application/json"}'::jsonb
--   );
--   return new;
-- end
-- $$;
-- drop trigger if exists notify_inquiries_webhook on public.inquiries;
-- create trigger notify_inquiries_webhook
--   after insert on public.inquiries
--   for each row execute function public.notify_inquiry_webhook();



