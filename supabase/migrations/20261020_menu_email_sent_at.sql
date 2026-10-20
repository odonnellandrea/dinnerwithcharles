-- Records when the "menu is live" email went out for a delivery date, so the admin button
-- can't send it twice by accident (Resend Menu Email sends again on purpose).
-- Run in the Supabase SQL editor (safe to re-run).
alter table public.delivery_settings add column if not exists menu_email_sent_at timestamptz;
