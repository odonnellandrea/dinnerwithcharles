-- When the customer last made an explicit email/text opt-in choice (null = never asked).
-- Existing customers start null, so they get a one-time "Stay in touch" prompt; their
-- current email_opt_in / sms_opt_in values are left untouched.
-- Run in the Supabase SQL editor (safe to re-run).

alter table public.users add column if not exists notification_prefs_set_at timestamptz;
