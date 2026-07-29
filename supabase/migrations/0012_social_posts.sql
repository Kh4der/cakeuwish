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
  -- provider handles, filled in as the state machine advances
  remote_id    text not null default '',  -- tweet id / fb post_id / ig media id
  remote_url   text not null default '',  -- permalink the admin can click
  upload_ref   text not null default '',  -- x media_id or ig creation_id, mid-flight
  attempts     int  not null default 0 check (attempts between 0 and 20),
  error        text not null default '',
  -- honours the platform's own backoff hint (X processing_info.check_after_secs,
  -- Instagram's "once a minute") so a tick knows when it is worth asking again
  next_poll_at timestamptz,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (post_id, platform)
);

create index if not exists social_targets_post_idx
  on public.social_targets (post_id);
-- the poller's working set: everything still in flight, soonest-due first
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

-- Private business records, exactly like orders/vendor_payments: no anon policy
-- at all. The serverless fan-out reaches PostgREST with the signed-in admin's
-- own JWT, so writes resolve to `authenticated` — no service-role key needed.
alter table public.social_posts   enable row level security;
alter table public.social_targets enable row level security;

drop policy if exists "social posts admin all"   on public.social_posts;
drop policy if exists "social targets admin all" on public.social_targets;
create policy "social posts admin all" on public.social_posts
  for all to authenticated using (true) with check (true);
create policy "social targets admin all" on public.social_targets
  for all to authenticated using (true) with check (true);

-- Installation config. Handles/URLs are public display data (the twitter_handle
-- precedent from 0011); every API key, page id and account id stays in Vercel
-- env, per deployment.
alter table public.site_config
  add column if not exists facebook_page_name   text not null default '';
alter table public.site_config
  add column if not exists instagram_handle     text not null default '';
-- WhatsApp has no publishing API at any tier; this URL only deep-links the
-- admin to the Channel so a human can post the update by hand.
alter table public.site_config
  add column if not exists whatsapp_channel_url text not null default '';

-- Column grants are additive; the `id` lesson from 0010 still applies.
grant select (facebook_page_name, instagram_handle, whatsapp_channel_url)
  on public.site_config to anon;

notify pgrst, 'reload schema';
