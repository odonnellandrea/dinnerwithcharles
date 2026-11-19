-- One-click unsubscribe from menu announcement emails, without signing in.
-- Each customer gets a random token; the link in the email carries it, and
-- unsubscribe_menu_emails() turns email_opt_in off for whoever holds that token.
alter table public.users add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists users_unsubscribe_token_key on public.users (unsubscribe_token);

-- Returns true when a customer was found (and is now unsubscribed), false for an unknown token.
create or replace function public.unsubscribe_menu_emails(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  found_id uuid;
begin
  update public.users
     set email_opt_in = false,
         notification_prefs_set_at = now()
   where unsubscribe_token = p_token
  returning id into found_id;
  return found_id is not null;
end
$$;
revoke all on function public.unsubscribe_menu_emails(uuid) from public;
grant execute on function public.unsubscribe_menu_emails(uuid) to anon, authenticated;
