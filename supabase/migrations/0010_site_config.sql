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
