-- Let a rejected customer update their answers and resubmit (rejected -> pending).
-- Every other approval_status change is still admin-only. Run in the Supabase SQL editor
-- after 20261012_enable_rls.sql (safe to re-run).

begin;

-- When the customer last resubmitted, so admin can see it's a second look
alter table public.users add column if not exists resubmitted_at timestamptz;

create or replace function public.users_guard_approval()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or new.approval_status is not distinct from old.approval_status then
    return new;
  end if;

  -- The one change a customer may make themselves: resubmit their own rejected request
  if old.approval_status = 'rejected'
     and new.approval_status = 'pending'
     and new.id = auth.uid() then
    return new;
  end if;

  raise exception 'Only an admin can change approval_status';
end
$$;

-- Trigger from 20261012_enable_rls.sql already calls this function; recreate it in case
drop trigger if exists users_guard_approval on public.users;
create trigger users_guard_approval before update on public.users
  for each row execute function public.users_guard_approval();

commit;
