-- Lets the request-to-join form tell someone their email already has an account on
-- step 1, instead of after they've filled in every step. Reads auth.users, so it's
-- security definer; it only ever answers true/false. Run in the Supabase SQL editor
-- (safe to re-run).
create or replace function public.email_taken(addr text)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(btrim(addr)))
$$;
revoke all on function public.email_taken(text) from public;
grant execute on function public.email_taken(text) to anon, authenticated;
