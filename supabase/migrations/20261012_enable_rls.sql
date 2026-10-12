-- Enable Row Level Security on every table and add policies.
-- Run in the Supabase SQL editor (safe to re-run).
--
--   customers  read/write only their own users row and Orders rows
--   menus      entrees, salads, add_ons, weekly_menu: read-only for signed-in users
--   settings   delivery_settings, surveys: read-only for signed-in users
--   admin      admin@dinnerwithcharles.com can read and write everything
--   anon       (signed out) gets nothing, except creating a pending profile at signup

begin;

-- Needed by the Orders insert policy below (same as 20261012_reheat_email_sent_at.sql)
alter table public."Orders" add column if not exists reheat_email_sent_at timestamptz;

-- ---------------------------------------------------------------- helpers

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@dinnerwithcharles.com'
$$;

create or replace function public.jwt_email()
returns text
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Signup inserts the profile right after auth.signUp(). When email confirmation
-- is on there's no session yet, so allow that insert only for an auth user created
-- in the last 15 minutes that has no profile yet. security definer so it can read auth.users.
create or replace function public.is_fresh_signup(uid uuid, addr text)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = uid
      and lower(u.email) = lower(addr)
      and u.created_at > now() - interval '15 minutes'
  ) and not exists (select 1 from public.users p where p.id = uid)
$$;
revoke all on function public.is_fresh_signup(uuid, text) from public;
grant execute on function public.is_fresh_signup(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------- users

alter table public.users enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert
  with check (
    approval_status = 'pending'
    and (id = auth.uid() or public.is_fresh_signup(id, email))
  );

drop policy if exists users_update on public.users;
create policy users_update on public.users for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists users_delete on public.users;
create policy users_delete on public.users for delete
  using (public.is_admin());

-- Customers can edit their own profile but never approve themselves
create or replace function public.users_guard_approval()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and new.approval_status is distinct from old.approval_status then
    raise exception 'Only an admin can change approval_status';
  end if;
  return new;
end
$$;
drop trigger if exists users_guard_approval on public.users;
create trigger users_guard_approval before update on public.users
  for each row execute function public.users_guard_approval();

-- ---------------------------------------------------------------- Orders

alter table public."Orders" enable row level security;

drop policy if exists orders_select on public."Orders";
create policy orders_select on public."Orders" for select
  using (lower(email) = public.jwt_email() or public.is_admin());

-- Customers may insert rows for their own order only when they're approved, the
-- delivery date is live and still open, and they have no other active order that date.
drop policy if exists orders_insert on public."Orders";
create policy orders_insert on public."Orders" for insert
  with check (
    public.is_admin()
    or (
      lower(email) = public.jwt_email()
      and status = 'pending'
      and reheat_email_sent_at is null
      and exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.approval_status = 'approved'
      )
      and exists (
        select 1 from public.delivery_settings ds
        where ds.delivery_date = "Orders".delivery_date
          and ds.is_live
          and (ds.order_close_datetime is null or now() < ds.order_close_datetime)
      )
      and not exists (
        select 1 from public."Orders" o
        where lower(o.email) = public.jwt_email()
          and o.delivery_date = "Orders".delivery_date
          and o.status <> 'cancelled'
          and o.order_id <> "Orders".order_id
      )
    )
  );

-- Orders are locked once placed: only admin can change or delete them
drop policy if exists orders_update on public."Orders";
create policy orders_update on public."Orders" for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_delete on public."Orders";
create policy orders_delete on public."Orders" for delete
  using (public.is_admin());

-- ------------------------------------------- menus + settings: read for signed-in, write for admin

do $$
declare t text;
begin
  foreach t in array array['entrees', 'salads', 'add_ons', 'weekly_menu', 'delivery_settings', 'surveys'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_write', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------- survey_responses

alter table public.survey_responses enable row level security;

drop policy if exists survey_responses_select on public.survey_responses;
create policy survey_responses_select on public.survey_responses for select
  using (lower(user_email) = public.jwt_email() or public.is_admin());

drop policy if exists survey_responses_insert on public.survey_responses;
create policy survey_responses_insert on public.survey_responses for insert
  with check (lower(user_email) = public.jwt_email());

drop policy if exists survey_responses_admin on public.survey_responses;
create policy survey_responses_admin on public.survey_responses for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------- any other public table the app doesn't use: admin only

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('users', 'Orders', 'entrees', 'salads', 'add_ons', 'weekly_menu', 'delivery_settings', 'surveys', 'survey_responses')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
    raise notice 'RLS enabled (admin only) on %', t;
  end loop;
end
$$;

commit;

-- Check: every public table should show rowsecurity = true
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
