-- A line per email the site sends (menu, welcome, order confirmation, reheat guide, admin notice),
-- so "did Taylor get the menu email?" can be answered from the Customers tab.
--
-- The send-email function writes here through log_email(), which runs as the table owner, because
-- a customer placing an order triggers their own confirmation email and must not need table access.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- menu_live | approved | order_confirmation | reheat_link | order_notice
  email text not null,
  subject text not null default '',
  status text not null default 'sent' check (status in ('sent', 'failed')),
  resend_id text,
  error text,
  order_id text,
  delivery_date date,
  created_at timestamptz not null default now()
);
create index if not exists email_log_email on public.email_log (lower(email), created_at desc);

alter table public.email_log enable row level security;
drop policy if exists email_log_admin on public.email_log;
create policy email_log_admin on public.email_log for select using (public.is_admin());

create or replace function public.log_email(
  p_kind text, p_email text, p_subject text, p_status text, p_resend_id text, p_error text, p_order_id text, p_delivery_date date
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.email_log (kind, email, subject, status, resend_id, error, order_id, delivery_date)
  values (p_kind, lower(coalesce(p_email, '')), coalesce(p_subject, ''), coalesce(p_status, 'sent'), p_resend_id, p_error, p_order_id, p_delivery_date);
$$;
revoke all on function public.log_email(text, text, text, text, text, text, text, date) from public;
grant execute on function public.log_email(text, text, text, text, text, text, text, date) to authenticated;
