-- Admin tools: sign-in tracking, paused accounts, per-customer pricing, payment tracking.
-- Run in the Supabase SQL editor (safe to re-run).

-- Each password sign-in is recorded here (the site inserts a row on a successful login).
create table if not exists public.user_logins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  signed_in_at timestamptz not null default now()
);
create index if not exists user_logins_user on public.user_logins (user_id, signed_in_at desc);
alter table public.user_logins enable row level security;
drop policy if exists user_logins_insert_own on public.user_logins;
create policy user_logins_insert_own on public.user_logins for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists user_logins_admin on public.user_logins;
create policy user_logins_admin on public.user_logins for select using (public.is_admin());

-- Admin only: last sign-in (from Supabase auth) and how many recorded logins each customer has
create or replace function public.admin_login_stats()
returns table (id uuid, last_sign_in_at timestamptz, login_count bigint)
language sql
security definer
set search_path = public, auth
as $$
  select p.id, a.last_sign_in_at, (select count(*) from public.user_logins l where l.user_id = p.id) as login_count
  from public.users p
  left join auth.users a on a.id = p.id
  where public.is_admin();
$$;
revoke all on function public.admin_login_stats() from public;
grant execute on function public.admin_login_stats() to authenticated;

-- What this customer pays for the base package (friends and family may differ), and whether
-- their orders are complimentary (no charge at all).
alter table public.users add column if not exists base_price numeric(8,2) not null default 160;
alter table public.users add column if not exists complimentary boolean not null default false;

-- One row per order: whether it has been paid. Admin only.
create table if not exists public.order_payments (
  order_id text primary key,
  email text,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'free')),
  amount_cents integer,
  paid_at timestamptz,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.order_payments enable row level security;
drop policy if exists order_payments_admin on public.order_payments;
create policy order_payments_admin on public.order_payments for all
  using (public.is_admin()) with check (public.is_admin());
