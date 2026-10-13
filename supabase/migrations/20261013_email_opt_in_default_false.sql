-- New customers are not opted in to marketing email unless they tick the box.
-- Only the column default changes; existing customers' email_opt_in values are untouched.
-- The signup form also always sends an explicit true/false, so it never relies on this default.
-- Run in the Supabase SQL editor.

alter table public.users alter column email_opt_in set default false;

-- Check: should show 'false'
-- select column_default from information_schema.columns
-- where table_schema = 'public' and table_name = 'users' and column_name = 'email_opt_in';
