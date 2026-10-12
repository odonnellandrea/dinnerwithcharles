-- UNDO for migrations/20261012_enable_rls.sql. Run in the Supabase SQL editor.
-- This puts the database back to how it was (RLS off = anyone with the public key
-- can read and write everything), so use it only to get unstuck, then fix forward.

-- Option A: undo just one table, e.g. if only ordering breaks:
--   alter table public."Orders" disable row level security;

-- Option B: undo everything
begin;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
end
$$;

-- The "only admin can change approval_status" trigger works even with RLS off; remove it too
drop trigger if exists users_guard_approval on public.users;

commit;

-- Policies and helper functions are left in place but do nothing while RLS is off,
-- so re-running the enable migration later restores everything.
