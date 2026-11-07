-- Run ONCE in the Supabase SQL editor (new query tab) on databases created with an older schema.sql.
-- (New projects do not need it: schema.sql already includes it.)
-- Adds:
--   1. products.date_arrived  – the date a container arrived, recorded by the admin when creating a product.
--   2. profiles.company_name  – the company / business name the admin enters when creating their account.
--      It is shown on the admin dashboard.

-- 1. Date arrived on products
alter table public.products add column if not exists date_arrived date;

-- 2. Company / business name on profiles
alter table public.profiles add column if not exists company_name text;

-- 3. Sign-up trigger: also save the company name from the sign-up form
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'manager');
        s uuid := nullif(new.raw_user_meta_data->>'store_id', '')::uuid;
        c text := nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '');
begin
  if r not in ('admin','manager') then r := 'manager'; end if;
  if r = 'admin' then s := null; end if;
  insert into public.profiles (id, full_name, email, company_name, role, store_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, c, r, s);
  return new;
end $$;

-- 4. CHECK TABLE: every row should say true
select check_name, ok from (
  select 1 as n, 'products has the date_arrived column' as check_name,
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'date_arrived') as ok
  union all select 2, 'profiles has the company_name column',
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_name')
  union all select 3, 'sign-up trigger saves the company name',
         position('company_name' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0
) c order by n;
