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
