-- Itemized API spend. 0009 only metered 'chat' and 'image'; every other paid
-- service (X posts, Vapi calls, Resend emails, receipt vision) was invisible.
-- This widens the vocabulary and adds the per-line detail an itemized report
-- needs. Run in the Supabase SQL editor AFTER earlier migrations (safe to re-run).

-- Widen the service vocabulary. The old constraint only allowed chat|image.
alter table public.usage_log drop constraint if exists usage_log_service_check;
alter table public.usage_log
  add constraint usage_log_service_check
  check (service in ('chat', 'image', 'social', 'voice', 'email', 'receipt'));

-- What the line item WAS: "X post", "Instagram reel", "call 2m14s",
-- "inquiry email". Shown verbatim in the admin's itemized table.
alter table public.usage_log add column if not exists detail text not null default '';
-- How many units the line represents (posts, calls, emails, images).
alter table public.usage_log add column if not exists quantity int not null default 1
  check (quantity between 0 and 10000);
-- Which provider actually billed it — the report groups by this so the owner
-- sees "Anthropic $2.10 / X $0.45" rather than an undifferentiated total.
alter table public.usage_log add column if not exists provider text not null default '';

create index if not exists usage_log_happened_idx on public.usage_log (happened_at desc);
create index if not exists usage_log_service_idx  on public.usage_log (service);

-- est_cost was capped at 1.0 for the old anon-insert threat model. A single
-- Vapi call or a linked X post can exceed that, so raise the ceiling while
-- keeping a bound that stops an anon insert poisoning the totals.
alter table public.usage_log drop constraint if exists usage_log_est_cost_check;
alter table public.usage_log
  add constraint usage_log_est_cost_check check (est_cost between 0 and 100);

notify pgrst, 'reload schema';
