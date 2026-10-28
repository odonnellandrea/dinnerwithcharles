-- "How did you hear about us?" on the join form. Run in the Supabase SQL editor (safe to re-run).
alter table public.users add column if not exists heard_about text;
alter table public.users add column if not exists heard_about_detail text;
