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
