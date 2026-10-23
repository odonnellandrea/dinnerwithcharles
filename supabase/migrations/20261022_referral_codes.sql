-- Referral and promo codes, with credits and discounts. Run in the Supabase SQL editor
-- (safe to re-run).
--
--   referral_codes     one row per code you create in the admin Codes tab:
--                      new_customer_discount_cents  off the first order of someone who joins with it
--                      owner_credit_cents           credit for the code's owner (the customer who
--                                                   referred them, or a business) once that new
--                                                   customer places their first order
--   referral_credits   credit owners have earned (or you added by hand) and what they spent
--   order_discounts    every discount taken off an order, so emails and totals can show it
--   users.referral_code the code someone typed on the join form
--
-- Customers never read these tables directly. They go through the functions below.

begin;

alter table public.users add column if not exists referral_code text;

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  kind text not null default 'referral' check (kind in ('referral', 'promo', 'business')),
  label text not null default '',
  owner_email text,
  new_customer_discount_cents integer not null default 1000 check (new_customer_discount_cents >= 0),
  owner_credit_cents integer not null default 0 check (owner_credit_cents >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists referral_codes_code_key on public.referral_codes (upper(code));

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  amount_cents integer not null check (amount_cents > 0),
  source_code text,
  referred_email text,
  note text not null default '',
  spent_order_id text,
  created_at timestamptz not null default now()
);
create index if not exists referral_credits_owner on public.referral_credits (lower(owner_email));

create table if not exists public.order_discounts (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  email text not null,
  kind text not null check (kind in ('new_customer', 'credit')),
  code text,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);
create index if not exists order_discounts_order on public.order_discounts (order_id);

alter table public.referral_codes enable row level security;
alter table public.referral_credits enable row level security;
alter table public.order_discounts enable row level security;

drop policy if exists referral_codes_admin on public.referral_codes;
create policy referral_codes_admin on public.referral_codes for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists referral_credits_admin on public.referral_credits;
create policy referral_credits_admin on public.referral_credits for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists referral_credits_own on public.referral_credits;
create policy referral_credits_own on public.referral_credits for select
  using (lower(owner_email) = public.jwt_email());

drop policy if exists order_discounts_admin on public.order_discounts;
create policy order_discounts_admin on public.order_discounts for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists order_discounts_own on public.order_discounts;
create policy order_discounts_own on public.order_discounts for select
  using (lower(email) = public.jwt_email());

-- The join form (signed out) asks whether a code is good. Says nothing else about it.
create or replace function public.check_referral_code(c text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.referral_codes%rowtype;
  used integer;
begin
  select * into r from public.referral_codes where upper(code) = upper(trim(coalesce(c, '')));
  if not found or not r.active or (r.expires_at is not null and r.expires_at < now()) then
    return jsonb_build_object('valid', false);
  end if;
  select count(*) into used from public.users where upper(referral_code) = upper(r.code);
  if r.max_uses is not null and used >= r.max_uses then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'discount_cents', r.new_customer_discount_cents, 'label', r.label);
end
$$;
revoke all on function public.check_referral_code(text) from public;
grant execute on function public.check_referral_code(text) to anon, authenticated;

-- What the signed-in customer would get off an order right now:
-- new_customer_cents (their join code, first order only) and credit_cents (unspent credit)
create or replace function public.my_pending_discount()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_code text;
  new_cents integer := 0;
  credit integer := 0;
begin
  if me = '' then
    return jsonb_build_object('new_customer_cents', 0, 'credit_cents', 0, 'has_code', false);
  end if;
  select referral_code into v_code from public.users where lower(email) = me limit 1;
  if coalesce(v_code, '') <> ''
     and not exists (select 1 from public.order_discounts where lower(email) = me and kind = 'new_customer') then
    select new_customer_discount_cents into new_cents
      from public.referral_codes where upper(code) = upper(v_code) and active;
  end if;
  select coalesce(sum(amount_cents), 0) into credit
    from public.referral_credits where lower(owner_email) = me and spent_order_id is null;
  return jsonb_build_object('new_customer_cents', coalesce(new_cents, 0), 'credit_cents', credit, 'has_code', coalesce(v_code, '') <> '');
end
$$;
revoke all on function public.my_pending_discount() from public;
revoke execute on function public.my_pending_discount() from anon;
grant execute on function public.my_pending_discount() to authenticated;

-- A signed-in customer who joined without a code can add one at checkout. One code per customer,
-- and not their own. Returns { ok, discount_cents } or { ok: false, reason }.
create or replace function public.attach_referral_code(c text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
  r public.referral_codes%rowtype;
  used integer;
  current_code text;
begin
  if me = '' then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  select referral_code into current_code from public.users where lower(email) = me limit 1;
  if coalesce(current_code, '') <> '' or exists (select 1 from public.order_discounts where lower(email) = me and kind = 'new_customer') then
    return jsonb_build_object('ok', false, 'reason', 'already_has_code');
  end if;
  select * into r from public.referral_codes where upper(code) = upper(trim(coalesce(c, '')));
  if not found or not r.active or (r.expires_at is not null and r.expires_at < now()) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if r.owner_email is not null and lower(r.owner_email) = me then
    return jsonb_build_object('ok', false, 'reason', 'own_code');
  end if;
  select count(*) into used from public.users where upper(referral_code) = upper(r.code);
  if r.max_uses is not null and used >= r.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update public.users set referral_code = r.code where lower(email) = me;
  return jsonb_build_object('ok', true, 'discount_cents', r.new_customer_discount_cents);
end
$$;
revoke all on function public.attach_referral_code(text) from public;
revoke execute on function public.attach_referral_code(text) from anon;
grant execute on function public.attach_referral_code(text) to authenticated;

-- Takes the discounts off the order the customer just placed (subtotal_cents is what they owed
-- before discounts) and returns the cents taken off. Safe to call twice for the same order.
-- Also awards the code's owner their credit the first time someone orders with their code.
create or replace function public.redeem_discounts(oid text, subtotal_cents integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_code text;
  rc public.referral_codes%rowtype;
  remaining integer := greatest(coalesce(subtotal_cents, 0), 0);
  applied integer := 0;
  d integer;
  c record;
begin
  if me = '' then return 0; end if;
  if not exists (select 1 from public."Orders" where order_id = oid and lower(email) = me) then
    return 0;
  end if;
  select coalesce(sum(amount_cents), 0) into applied from public.order_discounts where order_id = oid;
  if applied > 0 then return applied; end if;

  select referral_code into v_code from public.users where lower(email) = me limit 1;
  if coalesce(v_code, '') <> '' then
    select * into rc from public.referral_codes where upper(code) = upper(v_code) and active;
    if found then
      if rc.new_customer_discount_cents > 0
         and not exists (select 1 from public.order_discounts where lower(email) = me and kind = 'new_customer') then
        d := least(rc.new_customer_discount_cents, remaining);
        if d > 0 then
          insert into public.order_discounts (order_id, email, kind, code, amount_cents) values (oid, me, 'new_customer', rc.code, d);
          remaining := remaining - d;
          applied := applied + d;
        end if;
      end if;
      if rc.owner_email is not null and rc.owner_credit_cents > 0 and lower(rc.owner_email) <> me
         and not exists (select 1 from public.referral_credits where lower(referred_email) = me) then
        insert into public.referral_credits (owner_email, amount_cents, source_code, referred_email, note)
        values (rc.owner_email, rc.owner_credit_cents, rc.code, me, 'Earned when ' || me || ' placed their first order');
      end if;
    end if;
  end if;

  for c in select * from public.referral_credits
            where lower(owner_email) = me and spent_order_id is null and referred_email is distinct from me
            order by created_at, id loop
    exit when remaining <= 0;
    if c.amount_cents <= remaining then
      update public.referral_credits set spent_order_id = oid where id = c.id;
      d := c.amount_cents;
    else
      -- use part of it, and keep the rest as unspent credit
      update public.referral_credits set amount_cents = amount_cents - remaining where id = c.id;
      insert into public.referral_credits (owner_email, amount_cents, source_code, referred_email, note, spent_order_id)
      values (c.owner_email, remaining, c.source_code, c.referred_email, c.note, oid);
      d := remaining;
    end if;
    insert into public.order_discounts (order_id, email, kind, code, amount_cents) values (oid, me, 'credit', c.source_code, d);
    remaining := remaining - d;
    applied := applied + d;
  end loop;

  return applied;
end
$$;
revoke all on function public.redeem_discounts(text, integer) from public;
revoke execute on function public.redeem_discounts(text, integer) from anon;
grant execute on function public.redeem_discounts(text, integer) to authenticated;

commit;
