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
