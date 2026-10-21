-- Orders.total_order_price holds an add-on's unit price in dollars, but the column was created
-- as a whole-number type, so ordering an add-on failed ("invalid input syntax for type bigint").
-- This makes it an exact decimal. Existing whole-dollar values are kept as they are.
-- Run in the Supabase SQL editor (safe to re-run).
alter table public."Orders"
  alter column total_order_price type numeric(10, 2)
  using total_order_price::numeric;
