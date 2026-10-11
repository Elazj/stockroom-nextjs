-- Run ONCE in the Supabase SQL editor if you already ran the first schema.sql.
-- (New projects do not need this: schema.sql already includes it.)

-- 1. Fix: managers could not read the products in their store
drop policy if exists prod_read on products;
create policy prod_read on products for select to authenticated
  using (is_admin() or exists (select 1 from supplies s where s.product_id = products.id and s.store_id = my_store()));

-- 2. Managers can see the names of teammates in the same store (shown on sheets)
drop policy if exists prof_read on profiles;
create policy prof_read on profiles for select to authenticated
  using (id = auth.uid() or is_admin() or (store_id is not null and store_id = my_store()));

-- 3. Live updates for products and stores too
alter publication supabase_realtime add table products, stores;

-- 4. A manager without a store (for example after Google sign-in) can join one
create or replace function join_store(p_store uuid) returns void language sql security definer set search_path = public
as $$ update profiles set store_id = p_store where id = auth.uid() and role = 'manager' and store_id is null $$;
