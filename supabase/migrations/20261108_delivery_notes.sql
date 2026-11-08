-- Orders carry two notes now: special_notes is for the kitchen (food), delivery_notes is for
-- the drop-off (doorman, buzzer, timing). Run in the Supabase SQL editor (safe to re-run).
alter table public."Orders" add column if not exists delivery_notes text;
