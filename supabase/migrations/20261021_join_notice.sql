-- Lets the site email the admin when someone requests to join (or resubmits a request).
-- The join form can't read its own new row (there may be no session yet), so the
-- notify-request function calls this to atomically claim the notice and get the request
-- details. It only works for a request made in the last 15 minutes, and only once per
-- request, so it can't be used to spam. Run in the Supabase SQL editor (safe to re-run).

alter table public.users add column if not exists admin_notified_at timestamptz;

create or replace function public.claim_join_notice(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.users%rowtype;
  happened timestamptz;
begin
  select * into r from public.users where id = uid for update;
  if not found or r.approval_status is distinct from 'pending' then
    return null;
  end if;
  happened := greatest(r.created_at, coalesce(r.resubmitted_at, r.created_at));
  if happened < now() - interval '15 minutes' then
    return null;
  end if;
  if r.admin_notified_at is not null and r.admin_notified_at >= happened then
    return null;
  end if;
  update public.users set admin_notified_at = now() where id = uid;
  return to_jsonb(r) - 'admin_notified_at';
end
$$;
revoke all on function public.claim_join_notice(uuid) from public;
grant execute on function public.claim_join_notice(uuid) to anon, authenticated;
