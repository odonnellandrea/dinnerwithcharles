-- Customers outside the walking range get their orders by Uber messenger, with the
-- delivery cost passed through. Admin ticks this on the customer card; it adds the
-- fee to order totals and a note to the welcome and confirmation emails.
-- Run in the Supabase SQL editor (safe to re-run).
alter table public.users add column if not exists messenger_delivery boolean not null default false;
