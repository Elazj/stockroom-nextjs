-- migration-007: companies (one admin per company, data separated per company),
-- "date arrived" on products, and gifts.
--
-- Run ONCE in the Supabase SQL editor (new query tab), after migration-002 to 006 (or repair.sql).
-- New projects do not need it: schema.sql already includes everything here.
-- Safe to run again: every step checks before it changes anything.
--
-- What happens to the data you already have:
--   * One company called "My company" is created and ALL existing stores, products, supplies,
--     entries, reports and manager accounts are moved into it. The first admin (oldest account) owns it.
--     Rename it afterwards with:  update companies set name = 'Your real company name' where name = 'My company';
--   * If you had more than one admin, each extra admin gets their own EMPTY company
--     (called "Company of <name> (xxxx)"), because a company can only have one admin.

-- 1. Companies ------------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz default now()
);

-- 2. company_id on every table (nullable for now, filled in step 3) --------------------------
alter table public.stores       add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.profiles     add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.products     add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.supplies     add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.sheet_rows   add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.losses       add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.reports      add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.activity_log add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- 3. Move existing data into a company ------------------------------------------------------
do $$
declare
  first_admin uuid;
  main_company uuid;
  a record;
  cid uuid;
begin
  if exists (select 1 from public.stores where company_id is null)
     or exists (select 1 from public.products where company_id is null)
     or exists (select 1 from public.supplies where company_id is null)
     or exists (select 1 from public.sheet_rows where company_id is null)
     or exists (select 1 from public.losses where company_id is null)
     or exists (select 1 from public.reports where company_id is null)
     or exists (select 1 from public.activity_log where company_id is null)
     or exists (select 1 from public.profiles where company_id is null and (role = 'admin' or store_id is not null))
  then
    select id into first_admin from public.profiles where role = 'admin' order by created_at, id limit 1;

    select id into main_company from public.companies where lower(btrim(name)) = 'my company' limit 1;
    if main_company is null then
      insert into public.companies (name) values ('My company') returning id into main_company;
    end if;

    update public.stores       set company_id = main_company where company_id is null;
    update public.products     set company_id = main_company where company_id is null;
    update public.supplies     set company_id = main_company where company_id is null;
    update public.sheet_rows   set company_id = main_company where company_id is null;
    update public.losses       set company_id = main_company where company_id is null;
    update public.reports      set company_id = main_company where company_id is null;
    update public.activity_log set company_id = main_company where company_id is null;

    -- managers that already belong to a store, and the first admin
    update public.profiles set company_id = main_company
      where company_id is null and (store_id is not null or id = first_admin);

    -- every other admin gets an empty company of their own
    for a in select id, full_name from public.profiles where role = 'admin' and company_id is null order by created_at, id loop
      insert into public.companies (name)
        values ('Company of ' || left(a.full_name, 50) || ' (' || left(a.id::text, 4) || ')')
        returning id into cid;
      update public.profiles set company_id = cid where id = a.id;
    end loop;
  end if;
end $$;

-- 4. Rules: company names are unique, one admin per company ---------------------------------
-- Names are compared ignoring capital letters and extra spaces ("Acme  Ltd" = "acme ltd").
create unique index if not exists companies_name_unique
  on public.companies (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
create unique index if not exists one_admin_per_company
  on public.profiles (company_id) where role = 'admin';

-- The same product + container can now exist in different companies
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    where t.relnamespace = 'public'::regnamespace and t.relname = 'products' and con.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = con.conrelid and a.attnum = any (con.conkey)) = array['container_no', 'name']
  loop
    execute format('alter table public.products drop constraint %I', c.conname);
  end loop;
end $$;
create unique index if not exists products_company_name_container on public.products (company_id, name, container_no);

-- 5. Helper: the company of the signed-in user, used as the default for new rows ------------
create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public
as $$ select company_id from public.profiles where id = auth.uid() $$;
grant execute on function public.my_company() to authenticated;

-- Keeps the supplies write policy from recursively evaluating products RLS.
create or replace function public.product_in_my_company(p_product uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.products where id = p_product and company_id = public.my_company()) $$;
grant execute on function public.product_in_my_company(uuid) to authenticated;

alter table public.stores       alter column company_id set default public.my_company();
alter table public.products     alter column company_id set default public.my_company();
alter table public.supplies     alter column company_id set default public.my_company();
alter table public.sheet_rows   alter column company_id set default public.my_company();
alter table public.losses       alter column company_id set default public.my_company();
alter table public.reports      alter column company_id set default public.my_company();
alter table public.activity_log alter column company_id set default public.my_company();

alter table public.stores       alter column company_id set not null;
alter table public.products     alter column company_id set not null;
alter table public.supplies     alter column company_id set not null;
alter table public.sheet_rows   alter column company_id set not null;
alter table public.losses       alter column company_id set not null;
alter table public.reports      alter column company_id set not null;
alter table public.activity_log alter column company_id set not null;

create index if not exists stores_company on public.stores (company_id);
create index if not exists products_company on public.products (company_id);
create index if not exists supplies_company on public.supplies (company_id);
create index if not exists profiles_company on public.profiles (company_id);

-- 6. Date arrived on products ---------------------------------------------------------------
alter table public.products add column if not exists date_arrived date;
update public.products set date_arrived = created_at::date where date_arrived is null;
alter table public.products alter column date_arrived set default current_date;
alter table public.products alter column date_arrived set not null;

-- 7. Gifts ------------------------------------------------------------------------------------
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supplies on delete cascade,
  recipient text not null,
  quantity numeric not null check (quantity > 0),
  note text,
  entered_by uuid not null default auth.uid() references public.profiles,
  created_at timestamptz default now(),
  client_id uuid,
  company_id uuid not null default public.my_company() references public.companies on delete cascade
);
create unique index if not exists gifts_client_id on public.gifts (client_id) where client_id is not null;

-- Remaining = quantity in store - supplied - gifted - damaged - missing
drop view if exists public.supply_balance;
create view public.supply_balance with (security_invoker = true) as
select *, assigned - supplied - gifted - damaged_in_supply - missing_in_supply as remaining from (
  select s.id as supply_id, s.store_id, s.product_id, s.quantity as assigned,
    coalesce((select sum(quantity) from public.sheet_rows r where r.supply_id = s.id), 0) as supplied,
    coalesce((select sum(quantity) from public.gifts g where g.supply_id = s.id), 0) as gifted,
    coalesce((select sum(quantity) from public.losses l where l.supply_id = s.id and l.kind = 'damaged'), 0) as damaged_in_supply,
    coalesce((select sum(quantity) from public.losses l where l.supply_id = s.id and l.kind = 'missing'), 0) as missing_in_supply
  from public.supplies s) t;

-- A manager can never gift more than what is left
drop trigger if exists gifts_guard on public.gifts;
create trigger gifts_guard before insert on public.gifts for each row execute function public.guard_overdraw();

-- 8. Sign-up trigger ----------------------------------------------------------------------------
-- * An admin signing up creates a NEW company (the name must be free).
-- * A manager account only gets a store when the server API (admin Team page) provisions it.
--   Sign-up data sent by a browser is never trusted for that, so nobody can join another company.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  um jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  am jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  r text := 'manager';
  s uuid := null;
  cid uuid := null;
  cname text := left(regexp_replace(btrim(coalesce(um->>'company_name', '')), '\s+', ' ', 'g'), 80);
begin
  if nullif(am->>'store_id', '') is not null then
    s := (am->>'store_id')::uuid;
    select company_id into cid from public.stores where id = s;
    if cid is null then s := null; end if;
  elsif um->>'role' = 'admin' then
    r := 'admin';
    if char_length(cname) < 2 then raise exception 'Enter the company or business name'; end if;
    begin
      insert into public.companies (name) values (cname) returning id into cid;
    exception when unique_violation then
      raise exception 'Account/company name already exists';
    end;
  end if;
  insert into public.profiles (id, full_name, email, role, store_id, company_id)
  values (new.id, coalesce(um->>'full_name', um->>'name', split_part(new.email, '@', 1)), new.email, r, s, cid);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- The sign-up form asks this before sending anything (callable before login)
create or replace function public.company_name_taken(p_name text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.companies
  where lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'))
) $$;
grant execute on function public.company_name_taken(text) to anon, authenticated;

-- Stores of the signed-in user's company only (no longer public)
create or replace function public.open_stores() returns table (id uuid, name text, accounts int)
language sql stable security definer set search_path = public
as $$ select s.id, s.name, (select count(*)::int from public.profiles p where p.store_id = s.id and p.role = 'manager')
      from public.stores s where s.active and s.company_id = public.my_company() $$;
grant execute on function public.open_stores() to authenticated;

-- A manager can only join a store of their own company (accounts without a company cannot join)
create or replace function public.join_store(p_store uuid) returns void
language sql security definer set search_path = public
as $$ update public.profiles p set store_id = p_store
      where p.id = auth.uid() and p.role = 'manager' and p.store_id is null and p.company_id is not null
        and exists (select 1 from public.stores s where s.id = p_store and s.company_id = p.company_id) $$;
grant execute on function public.join_store(uuid) to authenticated;

-- "Reset all data" now clears only the admin's own company
create or replace function public.reset_all_data(wipe_accounts boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_company();
begin
  if not public.is_admin() or cid is null then raise exception 'Only an admin can reset the data'; end if;
  delete from public.activity_log where company_id = cid;
  delete from public.reports where company_id = cid;
  delete from public.gifts where company_id = cid;
  delete from public.losses where company_id = cid;
  delete from public.sheet_rows where company_id = cid;
  delete from public.supplies where company_id = cid;
  delete from public.products where company_id = cid;
  delete from public.stores where company_id = cid;
  if wipe_accounts then
    delete from auth.users where id in (select id from public.profiles where company_id = cid and id <> auth.uid());
  end if;
end $$;
grant execute on function public.reset_all_data(boolean) to authenticated;

-- 9. Row level security: every policy now also checks the company -----------------------------
alter table public.companies enable row level security;
alter table public.gifts enable row level security;

drop policy if exists co_read on public.companies;
create policy co_read on public.companies for select to authenticated using (id = (select public.my_company()));

drop policy if exists stores_read on public.stores;
drop policy if exists stores_admin on public.stores;
create policy stores_read  on public.stores for select to authenticated using (company_id = (select public.my_company()));
create policy stores_admin on public.stores for all to authenticated
  using ((select public.is_admin()) and company_id = (select public.my_company()))
  with check ((select public.is_admin()) and company_id = (select public.my_company()));

drop policy if exists prof_read on public.profiles;
drop policy if exists prof_admin on public.profiles;
create policy prof_read on public.profiles for select to authenticated
  using (id = auth.uid() or ((select public.is_admin()) and company_id = (select public.my_company())) or (store_id is not null and store_id = (select public.my_store())));
create policy prof_admin on public.profiles for update to authenticated
  using ((select public.is_admin()) and company_id = (select public.my_company()))
  with check ((select public.is_admin()) and company_id = (select public.my_company())
    and (store_id is null or exists (select 1 from public.stores s where s.id = store_id and s.company_id = (select public.my_company()))));

drop policy if exists prod_read on public.products;
drop policy if exists prod_admin on public.products;
create policy prod_read on public.products for select to authenticated
  using (((select public.is_admin()) and company_id = (select public.my_company()))
    or exists (select 1 from public.supplies s where s.product_id = products.id and s.store_id = (select public.my_store())));
create policy prod_admin on public.products for all to authenticated
  using ((select public.is_admin()) and company_id = (select public.my_company()))
  with check ((select public.is_admin()) and company_id = (select public.my_company()));

drop policy if exists sup_read on public.supplies;
drop policy if exists sup_admin on public.supplies;
create policy sup_read on public.supplies for select to authenticated
  using (((select public.is_admin()) and company_id = (select public.my_company())) or store_id = (select public.my_store()));
create policy sup_admin on public.supplies for all to authenticated
  using ((select public.is_admin()) and company_id = (select public.my_company()))
  with check ((select public.is_admin()) and company_id = (select public.my_company())
    and exists (select 1 from public.stores st where st.id = store_id and st.company_id = (select public.my_company()))
    and (select public.product_in_my_company(product_id)));

drop policy if exists rows_read on public.sheet_rows;
drop policy if exists rows_add on public.sheet_rows;
create policy rows_read on public.sheet_rows for select to authenticated
  using (((select public.is_admin()) and company_id = (select public.my_company()))
    or exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store())));
create policy rows_add on public.sheet_rows for insert to authenticated
  with check (entered_by = auth.uid() and company_id = (select public.my_company())
    and exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store()) and s.sheet_started_at is not null));

drop policy if exists loss_read on public.losses;
drop policy if exists loss_add on public.losses;
create policy loss_read on public.losses for select to authenticated
  using (((select public.is_admin()) and company_id = (select public.my_company()))
    or exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store())));
create policy loss_add on public.losses for insert to authenticated
  with check (entered_by = auth.uid() and company_id = (select public.my_company())
    and exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store()) and s.sheet_started_at is not null));

drop policy if exists gift_read on public.gifts;
drop policy if exists gift_add on public.gifts;
create policy gift_read on public.gifts for select to authenticated
  using (((select public.is_admin()) and company_id = (select public.my_company()))
    or exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store())));
create policy gift_add on public.gifts for insert to authenticated
  with check (entered_by = auth.uid() and company_id = (select public.my_company())
    and exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store()) and s.sheet_started_at is not null));

drop policy if exists rep_read on public.reports;
drop policy if exists rep_add on public.reports;
drop policy if exists rep_admin on public.reports;
create policy rep_read on public.reports for select to authenticated
  using (author = auth.uid() or ((select public.is_admin()) and company_id = (select public.my_company())));
create policy rep_add on public.reports for insert to authenticated
  with check (author = auth.uid() and company_id = (select public.my_company()));
create policy rep_admin on public.reports for update to authenticated
  using ((select public.is_admin()) and company_id = (select public.my_company()))
  with check ((select public.is_admin()) and company_id = (select public.my_company()));

drop policy if exists log_read on public.activity_log;
drop policy if exists log_add on public.activity_log;
create policy log_read on public.activity_log for select to authenticated
  using (actor = auth.uid() or ((select public.is_admin()) and company_id = (select public.my_company())));
create policy log_add on public.activity_log for insert to authenticated
  with check (actor = auth.uid() and company_id = (select public.my_company()));

-- 10. Table access and live updates for the new tables --------------------------------------
grant select on public.companies to authenticated;
grant select, insert, update, delete on public.gifts to authenticated;
grant all on public.companies, public.gifts to service_role;
grant select on public.supply_balance to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gifts') then
    alter publication supabase_realtime add table public.gifts;
  end if;
end $$;

-- 11. Check: every row should say true -----------------------------------------------------------
select check_name, ok from (
  select 1 as n, 'every store, product and entry belongs to a company' as check_name,
         not exists (select 1 from public.stores where company_id is null)
         and not exists (select 1 from public.products where company_id is null) as ok
  union all select 2, 'company names are unique', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'companies_name_unique')
  union all select 3, 'one admin per company', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'one_admin_per_company')
  union all select 4, 'products have a date arrived', (select count(*) = 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'date_arrived')
  union all select 5, 'gifts table exists', to_regclass('public.gifts') is not null
  union all select 6, 'stock balance counts gifts', (select count(*) = 1 from information_schema.columns where table_schema = 'public' and table_name = 'supply_balance' and column_name = 'gifted')
  union all select 7, 'row security is on for every table', (select coalesce(bool_and(relrowsecurity), false) from pg_class where relnamespace = 'public'::regnamespace and relname in ('companies','stores','profiles','products','supplies','sheet_rows','losses','gifts','reports','activity_log'))
  union all select 8, 'reset is limited to one company', position('my_company' in pg_get_functiondef('public.reset_all_data(boolean)'::regprocedure)) > 0
) c order by n;
