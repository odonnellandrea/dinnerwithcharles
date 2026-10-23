-- Chef Rob is an admin too. is_admin() is what every access rule checks, so this one change
-- gives his account the same reach as admin@. Keep in step with src/lib/admins.js.
-- Run in the Supabase SQL editor (safe to re-run).
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('admin@dinnerwithcharles.com', 'rodonnell6891@gmail.com')
$$;
