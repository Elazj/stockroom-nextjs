-- migration-011: settings pages.
--   * company settings (General Settings, Inventory Configuration)
--   * per-user preferences (Notifications)
--   * change my own name
--   * restore a backup
--   * delete my account (admin)
-- Run ONCE in the Supabase SQL editor (new query tab), after migration-007. Safe to run again.

-- 1. Where the settings are kept ---------------------------------------------------------------
alter table public.companies add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles  add column if not exists prefs jsonb not null default '{}'::jsonb;

-- 2. Admin saves company settings (and optionally renames the company) ------------------------
-- Settings are merged into what is already stored, so each settings page only sends its own part.
create or replace function public.update_company_settings(p_name text default null, p_settings jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_company();
  nm text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 80);
begin
  if not public.is_admin() or cid is null then
    raise exception 'Only an admin can change the company settings';
  end if;
  if p_name is not null then
    if char_length(nm) < 2 then raise exception 'Enter the company or business name'; end if;
    begin
      update public.companies set name = nm where id = cid;
    exception when unique_violation then
      raise exception 'Account/company name already exists';
    end;
  end if;
  if p_settings is not null then
    update public.companies set settings = settings || p_settings where id = cid;
  end if;
end $$;
grant execute on function public.update_company_settings(text, jsonb) to authenticated;

-- 3. Anyone changes their own name and notification choices ------------------------------------
-- (A function, not an open UPDATE rule, so nobody can change their own role or store.)
create or replace function public.update_my_profile(p_name text default null, p_prefs jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare nm text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 80);
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_name is not null and char_length(nm) < 2 then raise exception 'Enter your full name'; end if;
  update public.profiles
     set full_name = case when p_name is not null then nm else full_name end,
         prefs = case when p_prefs is not null then prefs || p_prefs else prefs end
   where id = auth.uid();
end $$;
grant execute on function public.update_my_profile(text, jsonb) to authenticated;

-- 4. Delete my account: the admin's company, all its data, every manager account and the admin login
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_company();
  ids uuid[];
begin
  if not public.is_admin() or cid is null then
    raise exception 'Only an admin can delete the account';
  end if;
  select array_agg(id) into ids from public.profiles where company_id = cid;
  delete from public.companies where id = cid;   -- cascades to stores, products, supplies, entries, gifts, reports, activity
  delete from auth.users where id = any (ids);   -- their profiles go with them
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- 5. Restore a backup made by Backup & Restore ----------------------------------------------------
-- Replaces the data of the admin's own company with the contents of the backup file.
-- Accounts are not part of a backup: entries made by someone who no longer has an account are
-- kept and shown as entered by the admin. Managers keep their store when that store is in the backup.
create or replace function public.restore_company_backup(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_company();
  me uuid := auth.uid();
  asg jsonb;
begin
  if not public.is_admin() or cid is null then
    raise exception 'Only an admin can restore a backup';
  end if;
  if coalesce(p->>'format', '') <> 'stockroom-backup-1' then
    raise exception 'This file is not a Stockroom backup';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'store', store_id)), '[]'::jsonb) into asg
    from public.profiles where company_id = cid and role = 'manager' and store_id is not null;

  delete from public.activity_log where company_id = cid;
  delete from public.reports where company_id = cid;
  delete from public.gifts where company_id = cid;
  delete from public.losses where company_id = cid;
  delete from public.sheet_rows where company_id = cid;
  delete from public.supplies where company_id = cid;
  delete from public.products where company_id = cid;
  delete from public.stores where company_id = cid;

  insert into public.stores (id, company_id, name, location, manager_name, active, created_at)
  select x.id, cid, x.name, x.location, x.manager_name, coalesce(x.active, true), coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p->'stores', '[]'::jsonb))
    as x(id uuid, name text, location text, manager_name text, active boolean, created_at timestamptz);

  insert into public.products (id, company_id, name, container_no, unit, total, damaged_offload, missing_before_offload, date_arrived, created_at)
  select x.id, cid, x.name, x.container_no, coalesce(x.unit, 'pieces'), x.total, coalesce(x.damaged_offload, 0),
         coalesce(x.missing_before_offload, 0), coalesce(x.date_arrived, current_date), coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p->'products', '[]'::jsonb))
    as x(id uuid, name text, container_no text, unit text, total numeric, damaged_offload numeric, missing_before_offload numeric, date_arrived date, created_at timestamptz);

  insert into public.supplies (id, company_id, product_id, store_id, quantity, sheet_started_by, sheet_started_at)
  select x.id, cid, x.product_id, x.store_id, x.quantity,
         (select pr.id from public.profiles pr where pr.id = x.sheet_started_by and pr.company_id = cid), x.sheet_started_at
  from jsonb_to_recordset(coalesce(p->'supplies', '[]'::jsonb))
    as x(id uuid, product_id uuid, store_id uuid, quantity numeric, sheet_started_by uuid, sheet_started_at timestamptz);

  insert into public.sheet_rows (id, company_id, supply_id, customer, supply_ref, quantity, entered_by, created_at, client_id)
  select x.id, cid, x.supply_id, x.customer, x.supply_ref, x.quantity,
         coalesce((select pr.id from public.profiles pr where pr.id = x.entered_by and pr.company_id = cid), me),
         coalesce(x.created_at, now()), x.client_id
  from jsonb_to_recordset(coalesce(p->'sheet_rows', '[]'::jsonb))
    as x(id uuid, supply_id uuid, customer text, supply_ref text, quantity numeric, entered_by uuid, created_at timestamptz, client_id uuid);

  insert into public.losses (id, company_id, supply_id, kind, quantity, note, entered_by, created_at, client_id)
  select x.id, cid, x.supply_id, x.kind, x.quantity, x.note,
         coalesce((select pr.id from public.profiles pr where pr.id = x.entered_by and pr.company_id = cid), me),
         coalesce(x.created_at, now()), x.client_id
  from jsonb_to_recordset(coalesce(p->'losses', '[]'::jsonb))
    as x(id uuid, supply_id uuid, kind text, quantity numeric, note text, entered_by uuid, created_at timestamptz, client_id uuid);

  insert into public.gifts (id, company_id, supply_id, recipient, quantity, note, entered_by, created_at, client_id)
  select x.id, cid, x.supply_id, x.recipient, x.quantity, x.note,
         coalesce((select pr.id from public.profiles pr where pr.id = x.entered_by and pr.company_id = cid), me),
         coalesce(x.created_at, now()), x.client_id
  from jsonb_to_recordset(coalesce(p->'gifts', '[]'::jsonb))
    as x(id uuid, supply_id uuid, recipient text, quantity numeric, note text, entered_by uuid, created_at timestamptz, client_id uuid);

  insert into public.reports (id, company_id, author, category, subject, message, resolved, created_at)
  select x.id, cid,
         coalesce((select pr.id from public.profiles pr where pr.id = x.author and pr.company_id = cid), me),
         x.category, x.subject, x.message, coalesce(x.resolved, false), coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p->'reports', '[]'::jsonb))
    as x(id uuid, author uuid, category text, subject text, message text, resolved boolean, created_at timestamptz);

  insert into public.activity_log (id, company_id, actor, message, created_at)
  select x.id, cid,
         coalesce((select pr.id from public.profiles pr where pr.id = x.actor and pr.company_id = cid), me),
         x.message, coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p->'activity_log', '[]'::jsonb))
    as x(id uuid, actor uuid, message text, created_at timestamptz);

  -- managers go back to their stores (when the store came back with the backup)
  update public.profiles pr set store_id = a.store
  from jsonb_to_recordset(asg) as a(id uuid, store uuid)
  where pr.id = a.id and exists (select 1 from public.stores s where s.id = a.store and s.company_id = cid);
end $$;
grant execute on function public.restore_company_backup(jsonb) to authenticated;


-- 5b. Gifts only while the admin allows them (Inventory Configuration > Let managers record gifts)
drop policy if exists gift_add on public.gifts;
create policy gift_add on public.gifts for insert to authenticated
  with check (entered_by = auth.uid() and company_id = (select public.my_company())
    and coalesce((select (c.settings->>'allowGifts')::boolean from public.companies c where c.id = company_id), true)
    and exists (select 1 from public.supplies s where s.id = supply_id and s.store_id = (select public.my_store()) and s.sheet_started_at is not null));

-- 6. Check: every row should say true ------------------------------------------------------------------
select check_name, ok from (
  select 1 as n, 'company settings column' as check_name,
         (select count(*) = 1 from information_schema.columns where table_schema = 'public' and table_name = 'companies' and column_name = 'settings') as ok
  union all select 2, 'user preferences column',
         (select count(*) = 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'prefs')
  union all select 3, 'settings, profile, restore and delete functions exist',
         to_regprocedure('public.update_company_settings(text,jsonb)') is not null
         and to_regprocedure('public.update_my_profile(text,jsonb)') is not null
         and to_regprocedure('public.restore_company_backup(jsonb)') is not null
         and to_regprocedure('public.delete_my_account()') is not null
) c order by n;