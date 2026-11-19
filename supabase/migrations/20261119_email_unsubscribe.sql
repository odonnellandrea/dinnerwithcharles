-- Email choices split in two, like texts: weekly menu emails (email_opt_in) and news and
-- offers (email_marketing_opt_in). Plus a no-sign-in email preferences page reached from the
-- link in every marketing email. Run in the Supabase SQL editor (safe to re-run).

-- New column. When it's first added, everyone currently opted in to email gets news and
-- offers too: the old single box covered menu announcements and news.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'users' and column_name = 'email_marketing_opt_in') then
    alter table public.users add column email_marketing_opt_in boolean not null default false;
    update public.users set email_marketing_opt_in = true where email_opt_in is true;
  end if;
end
$$;

-- Each customer gets a random token; the link in the email carries it
alter table public.users add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists users_unsubscribe_token_key on public.users (unsubscribe_token);

drop function if exists public.unsubscribe_menu_emails(uuid);

-- What the preferences page shows: first name and the two email choices, nothing else.
-- Null for an unknown token.
create or replace function public.email_prefs_for_token(p_token uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object('first_name', first_name, 'menu', email_opt_in is true, 'marketing', email_marketing_opt_in is true)
    from public.users where unsubscribe_token = p_token;
$$;
revoke all on function public.email_prefs_for_token(uuid) from public;
grant execute on function public.email_prefs_for_token(uuid) to anon, authenticated;

-- Saves both choices (false, false = unsubscribe from all). True when the customer was found.
create or replace function public.set_email_prefs_for_token(p_token uuid, p_menu boolean, p_marketing boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  found_id uuid;
begin
  update public.users
     set email_opt_in = coalesce(p_menu, false),
         email_marketing_opt_in = coalesce(p_marketing, false),
         notification_prefs_set_at = now()
   where unsubscribe_token = p_token
  returning id into found_id;
  return found_id is not null;
end
$$;
revoke all on function public.set_email_prefs_for_token(uuid, boolean, boolean) from public;
grant execute on function public.set_email_prefs_for_token(uuid, boolean, boolean) to anon, authenticated;
