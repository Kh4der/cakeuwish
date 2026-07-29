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
