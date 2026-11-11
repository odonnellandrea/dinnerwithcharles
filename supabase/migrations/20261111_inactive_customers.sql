-- Inactive customers: approved people who have drifted off. They keep their login and the
-- standard emails, but This Week no longer counts them as "not yet ordered".
alter table public.users add column if not exists inactive boolean not null default false;
