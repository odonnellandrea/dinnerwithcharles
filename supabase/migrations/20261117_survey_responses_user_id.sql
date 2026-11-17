-- Link each survey answer to the customer's permanent id instead of relying on email alone
-- (emails can change). The email column stays as a backup.
alter table public.survey_responses add column if not exists user_id uuid references public.users(id) on delete set null;

-- Fill in the answers that already exist by matching today's emails
update public.survey_responses r set user_id = u.id
from public.users u
where r.user_id is null and lower(u.email) = lower(r.user_email);

create index if not exists survey_responses_user_id_idx on public.survey_responses(user_id);
