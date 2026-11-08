-- Customers tell us when they're away (one row per date range). They manage their own rows;
-- the admin can see everyone's. Run in the Supabase SQL editor (safe to re-run).
create table if not exists public.away_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  starts_on date not null,
  ends_on date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists away_dates_user on public.away_dates (user_id, ends_on);
alter table public.away_dates enable row level security;
drop policy if exists away_dates_own on public.away_dates;
create policy away_dates_own on public.away_dates for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists away_dates_admin on public.away_dates;
create policy away_dates_admin on public.away_dates for all
  using (public.is_admin()) with check (public.is_admin());
