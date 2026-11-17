-- Apartment / unit, kept apart from the street address so labels and packing lists can show it clearly.
alter table public.users add column if not exists apartment text;
