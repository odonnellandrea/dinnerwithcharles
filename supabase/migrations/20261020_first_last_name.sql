-- Separate first and last names. users.name stays as the full name (orders and the admin
-- list use it); first_name/last_name are what customers edit. Existing names are not
-- split: nothing can tell a first name from a last name reliably, so the new columns
-- start empty and the site shows the old full name until someone enters both parts.
-- Run in the Supabase SQL editor (safe to re-run).
alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists last_name text;
