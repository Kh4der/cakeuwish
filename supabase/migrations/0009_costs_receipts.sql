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
