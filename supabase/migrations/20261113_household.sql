-- Household: Andrea's own family (Mom, parents). Their orders are cooked and packed like anyone
-- else's, but they are not counted as customers on This Week or in the Orders week totals.
alter table public.users add column if not exists household boolean not null default false;
