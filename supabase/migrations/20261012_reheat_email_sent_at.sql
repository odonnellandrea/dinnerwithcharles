-- Track when the reheat-guide email went out so it's only sent the first time
-- an order is marked delivered. Run in the Supabase SQL editor.
alter table public."Orders" add column if not exists reheat_email_sent_at timestamptz;
