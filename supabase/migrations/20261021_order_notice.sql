-- Lets the site email the admin once per order when it is placed. The order confirmation
-- function calls claim_order_notice, which marks the order as announced and says whether it
-- was the first time, so repeated calls can't flood the admin inbox. Only the customer who
-- owns the order can claim it. Run in the Supabase SQL editor (safe to re-run).

alter table public."Orders" add column if not exists admin_notified_at timestamptz;

create or replace function public.claim_order_notice(oid text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public."Orders"
     set admin_notified_at = now()
   where order_id = oid
     and admin_notified_at is null
     and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  get diagnostics n = row_count;
  return n > 0;
end
$$;
revoke all on function public.claim_order_notice(text) from public;
grant execute on function public.claim_order_notice(text) to authenticated;
