-- X / Twitter: the handle joins the installation config (public info); the
-- four API secrets stay in Vercel env like every other key.
-- Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

alter table public.site_config add column if not exists twitter_handle text not null default '';

-- Column grants are additive; the id lesson from 0010 already applies.
grant select (twitter_handle) on public.site_config to anon;
notify pgrst, 'reload schema';
