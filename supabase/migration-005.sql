-- FIX for every admin tab showing "permission denied for table …".
-- Safe to run more than once. Paste into the Supabase SQL editor and press Run.
--
-- Why this failed before: GRANT EXECUTE ON open_stores() aborted the whole script
-- (that function is missing on older databases), so table grants were rolled back.
-- authenticated then had no SELECT on sheet_rows / stores / products / …

-- 1. Table access first (this is the actual "permission denied for table" fix)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'supply_balance'
  ) then
    execute 'grant select on public.supply_balance to authenticated';
  end if;
end $$;

-- 2. Recreate helpers that policies and the login page need, then grant execute
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.my_store() returns uuid
language sql stable security definer set search_path = public
as $$ select store_id from public.profiles where id = auth.uid() $$;

create or replace function public.open_stores() returns table (id uuid, name text, accounts int)
language sql stable security definer set search_path = public
as $$ select s.id, s.name, (select count(*)::int from public.profiles p where p.store_id = s.id and p.role = 'manager')
      from public.stores s where s.active $$;

create or replace function public.start_sheet(p_supply uuid) returns void
language sql security definer set search_path = public
as $$ update public.supplies set sheet_started_by = auth.uid(), sheet_started_at = now()
      where id = p_supply and store_id = public.my_store() and sheet_started_at is null $$;

create or replace function public.join_store(p_store uuid) returns void
language sql security definer set search_path = public
as $$ update public.profiles set store_id = p_store where id = auth.uid() and role = 'manager' and store_id is null $$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_store() to authenticated;
grant execute on function public.start_sheet(uuid) to authenticated;
grant execute on function public.join_store(uuid) to authenticated;
grant execute on function public.open_stores() to anon, authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- 3. Confirm: every public table/view should now show true
select c.relname as table_or_view, has_table_privilege('authenticated', c.oid, 'select') as signed_in_users_can_read
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
order by 1;
