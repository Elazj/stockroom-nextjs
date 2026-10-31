-- Run ONCE if you ran an older schema.sql and have not run this yet.
-- (New projects do not need it: schema.sql already includes it.)
drop policy if exists prod_read on products;
create policy prod_read on products for select to authenticated
  using (is_admin() or exists (select 1 from supplies s where s.product_id = products.id and s.store_id = my_store()));
drop policy if exists prof_read on profiles;
create policy prof_read on profiles for select to authenticated
  using (id = auth.uid() or is_admin() or (store_id is not null and store_id = my_store()));
alter publication supabase_realtime add table products, stores;
create or replace function join_store(p_store uuid) returns void language sql security definer set search_path = public
as $$ update profiles set store_id = p_store where id = auth.uid() and role = 'manager' and store_id is null $$;
