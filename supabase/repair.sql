-- STOCKROOM REPAIR SCRIPT
-- Safe to run more than once. Paste it into the Supabase SQL editor (New query) and press Run.
-- It brings an older database up to date (everything from migration-002 through 006 that is about tables,
-- grants and live updates), then shows a check table at the bottom. Every row of that table should say true.
--
-- COMPANIES: sign-up, the company rules, row security and "Reset all data" now live in migration-007.sql.
-- This script no longer touches them, so running it again can never undo the company separation.
-- On an older database: run this script first, then migration-007.sql.

-- 0. Offline sync: a client_id so a queued entry cannot insert twice
alter table public.sheet_rows add column if not exists client_id uuid;
alter table public.losses add column if not exists client_id uuid;
create unique index if not exists sheet_rows_client_id on public.sheet_rows (client_id) where client_id is not null;
create unique index if not exists losses_client_id on public.losses (client_id) where client_id is not null;

-- 1. Team page: each profile keeps the account's email and a disabled flag
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists disabled boolean not null default false;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- 2. Sign-up trigger: now defined in migration-007.sql (it creates the company for a new admin).

-- 3. At most 3 manager accounts per store
create or replace function public.limit_store_accounts() returns trigger language plpgsql as $$
begin
  if new.role = 'manager' and new.store_id is not null and
     (select count(*) from public.profiles where store_id = new.store_id and role = 'manager' and id <> new.id) >= 3
  then raise exception 'A store can have at most 3 accounts'; end if;
  return new;
end $$;
drop trigger if exists profiles_limit on public.profiles;
create trigger profiles_limit before insert or update on public.profiles for each row execute function public.limit_store_accounts();

-- 4 and 5. join_store and "Reset all data": now defined in migration-007.sql (they are limited to one company).

-- 5b. Recreate helpers that older databases may be missing, then grant access.
-- Do not GRANT a function before it exists: that aborts the script and rolls back table grants.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create or replace function public.my_store() returns uuid
language sql stable security definer set search_path = public
as $$ select store_id from public.profiles where id = auth.uid() $$;
create or replace function public.start_sheet(p_supply uuid) returns void
language sql security definer set search_path = public
as $$ update public.supplies set sheet_started_by = auth.uid(), sheet_started_at = now()
      where id = p_supply and store_id = public.my_store() and sheet_started_at is null $$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
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
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_store() to authenticated;
grant execute on function public.start_sheet(uuid) to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- 6. Security rules: now defined in migration-007.sql (they check the company too).

-- 7. Live updates for every table (skips tables that are already switched on)
do $$
declare t text;
begin
  foreach t in array array['supplies','sheet_rows','losses','reports','activity_log','products','stores','profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 8. CHECK TABLE: every row should say true
select check_name, ok from (
  select 1 as n, 'profiles has the email and disabled columns' as check_name,
         (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('email','disabled')) as ok
  union all select 2, 'sign-up trigger saves the email', position('new.email' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0
  union all select 3, 'sign-up trigger is attached', exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')
  union all select 4, 'three-accounts-per-store trigger is attached', exists (select 1 from pg_trigger where tgname = 'profiles_limit')
  union all select 5, 'reset function puts a WHERE on every delete', position('where ' in pg_get_functiondef('public.reset_all_data(boolean)'::regprocedure)) > 0
  union all select 6, 'managers can read the products of their store', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'prod_read' and qual like '%product_id = products.id%')
  union all select 7, 'managers can see teammates in their store', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'prof_read' and qual like '%my_store%')
  union all select 8, 'row security is on for every table', (select coalesce(bool_and(relrowsecurity), false) from pg_class where relnamespace = 'public'::regnamespace and relname in ('stores','profiles','products','supplies','sheet_rows','losses','reports','activity_log'))
  union all select 9, 'live updates are on for all 8 tables', (select count(*) = 8 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('supplies','sheet_rows','losses','reports','activity_log','products','stores','profiles'))
  union all select 10, 'at least one admin account exists', exists (select 1 from public.profiles where role = 'admin')
  union all select 11, 'logged-in users can call is_admin()', has_function_privilege('authenticated', 'public.is_admin()', 'execute')
  union all select 12, 'logged-in users can call my_store()', has_function_privilege('authenticated', 'public.my_store()', 'execute')
  union all select 13, 'logged-in users can read stores', has_table_privilege('authenticated', 'public.stores', 'select')
) c order by n;
