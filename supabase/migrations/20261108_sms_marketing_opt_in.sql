-- Text consent split in two: order and menu texts (sms_opt_in) and news and offers
-- (sms_marketing_opt_in). Run in the Supabase SQL editor (safe to re-run).
alter table public.users add column if not exists sms_marketing_opt_in boolean not null default false;
