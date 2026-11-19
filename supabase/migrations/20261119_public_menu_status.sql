-- The shareable menu page (/menu) needs to know whether ordering is open without a sign-in.
-- This returns only the live week's date, close time and live flag, nothing else.
create or replace function public.public_menu_status()
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(
    (select jsonb_build_object('delivery_date', delivery_date, 'order_close_datetime', order_close_datetime, 'is_live', is_live)
       from public.delivery_settings where is_live order by delivery_date desc limit 1),
    jsonb_build_object('is_live', false));
$$;
revoke all on function public.public_menu_status() from public;
grant execute on function public.public_menu_status() to anon, authenticated;
