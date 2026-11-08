-- migration-008: fix recursive RLS checks when an admin assigns a product to a store.
--
-- Run in the Supabase SQL editor after migration-007.sql.
-- Safe to run again.

create or replace function public.product_in_my_company(p_product uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.products
  where id = p_product and company_id = public.my_company()
) $$;
grant execute on function public.product_in_my_company(uuid) to authenticated;

drop policy if exists sup_admin on public.supplies;
create policy sup_admin on public.supplies for all to authenticated
  using ((select public.is_admin()) and company_id = (select public.my_company()))
  with check ((select public.is_admin()) and company_id = (select public.my_company())
    and exists (select 1 from public.stores st where st.id = store_id and st.company_id = (select public.my_company()))
    and (select public.product_in_my_company(product_id)));

select 'supplies policy recursion fix applied' as status;
