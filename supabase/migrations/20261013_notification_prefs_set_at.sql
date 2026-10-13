-- When the customer was asked about, or last chose, email/text updates (null = never asked).
-- Existing customers start null, so they're asked once on their next visit. This migration
-- doesn't change anyone's email_opt_in / sms_opt_in values.
-- Run in the Supabase SQL editor (safe to re-run).

alter table public.users add column if not exists notification_prefs_set_at timestamptz;
