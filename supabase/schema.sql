-- Stockroom schema. Paste into the Supabase SQL editor and run once (new projects only).
-- Already ran an older version? Run migration-002.sql and migration-003.sql instead.

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null, location text, manager_name text,
  active boolean not null default true, created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text,
  disabled boolean not null default false,
  role text not null default 'manager' check (role in ('admin','manager')),
  store_id uuid references stores on delete set null,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, container_no text not null, unit text not null default 'pieces',
  total numeric not null check (total > 0),
  damaged_offload numeric not null default 0 check (damaged_offload >= 0),
  missing_before_offload numeric not null default 0 check (missing_before_offload >= 0),
  net numeric generated always as (total - damaged_offload - missing_before_offload) stored,
  created_at timestamptz default now(),
  check (total - damaged_offload - missing_before_offload > 0),
  unique (name, container_no)
);

create table supplies (            -- a product added to a store
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  store_id uuid not null references stores on delete cascade,
  quantity numeric not null check (quantity > 0),
  sheet_started_by uuid references profiles, sheet_started_at timestamptz,
  unique (product_id, store_id)
);

create table sheet_rows (          -- customer, supply id (invoice/sales), quantity
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references supplies on delete cascade,
  customer text not null, supply_ref text not null,
  quantity numeric not null check (quantity > 0),
  entered_by uuid not null default auth.uid() references profiles, created_at timestamptz default now(),
  client_id uuid
);

create table losses (              -- damaged or missing during supply
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references supplies on delete cascade,
  kind text not null check (kind in ('damaged','missing')),
  quantity numeric not null check (quantity > 0), note text,
  entered_by uuid not null default auth.uid() references profiles, created_at timestamptz default now(),
  client_id uuid
);
create unique index sheet_rows_client_id on sheet_rows (client_id) where client_id is not null;
create unique index losses_client_id on losses (client_id) where client_id is not null;

create table reports (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references profiles,
  category text not null, subject text not null, message text not null,
  resolved boolean not null default false, created_at timestamptz default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null default auth.uid() references profiles,
  message text not null, created_at timestamptz default now()
);

-- Remaining = quantity in store - supplied - damaged - missing
create view supply_balance with (security_invoker = true) as
select *, assigned - supplied - damaged_in_supply - missing_in_supply as remaining from (
  select s.id as supply_id, s.store_id, s.product_id, s.quantity as assigned,
    coalesce((select sum(quantity) from sheet_rows r where r.supply_id = s.id), 0) as supplied,
    coalesce((select sum(quantity) from losses l where l.supply_id = s.id and l.kind = 'damaged'), 0) as damaged_in_supply,
    coalesce((select sum(quantity) from losses l where l.supply_id = s.id and l.kind = 'missing'), 0) as missing_in_supply
  from supplies s) t;

-- Helpers
create function is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create function my_store() returns uuid language sql stable security definer set search_path = public
as $$ select store_id from profiles where id = auth.uid() $$;
-- Policies call these. Supabase revokes PUBLIC execute, so logged-in users must be granted it
-- or every tab shows "permission denied".
grant execute on function is_admin() to authenticated;
grant execute on function my_store() to authenticated;

-- At most 3 manager accounts per store
create function limit_store_accounts() returns trigger language plpgsql as $$
begin
  if new.role = 'manager' and new.store_id is not null and
     (select count(*) from profiles where store_id = new.store_id and role = 'manager' and id <> new.id) >= 3
  then raise exception 'A store can have at most 3 accounts'; end if;
  return new;
end $$;
create trigger profiles_limit before insert or update on profiles for each row execute function limit_store_accounts();

-- Create a profile when someone signs up (email or Google)
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'manager');
        s uuid := nullif(new.raw_user_meta_data->>'store_id', '')::uuid;
begin
  if r not in ('admin','manager') then r := 'manager'; end if;
  -- SECURITY: this allows anyone to sign up as admin, as requested. For production,
  -- allow admin only when no admin exists yet, or promote people by hand.
  if r = 'admin' then s := null; end if;
  insert into profiles (id, full_name, email, role, store_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, r, s);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Stores open for sign-up, with account counts (callable before login)
create function open_stores() returns table (id uuid, name text, accounts int)
language sql stable security definer set search_path = public
as $$ select s.id, s.name, (select count(*)::int from profiles p where p.store_id = s.id and p.role = 'manager')
      from stores s where s.active $$;
grant execute on function open_stores() to anon, authenticated;

-- A manager can never record more than what is left
create function guard_overdraw() returns trigger language plpgsql security definer set search_path = public as $$
declare rem numeric;
begin
  select remaining into rem from supply_balance where supply_id = new.supply_id;
  if new.quantity > rem then raise exception 'Only % left in the store', rem; end if;
  return new;
end $$;
create trigger rows_guard before insert on sheet_rows for each row execute function guard_overdraw();
create trigger losses_guard before insert on losses for each row execute function guard_overdraw();

-- Manager creates the sheet for a product in their store
create function start_sheet(p_supply uuid) returns void language sql security definer set search_path = public
as $$ update supplies set sheet_started_by = auth.uid(), sheet_started_at = now()
      where id = p_supply and store_id = my_store() and sheet_started_at is null $$;
grant execute on function start_sheet(uuid) to authenticated;

-- A manager without a store (for example after Google sign-in) joins one
create function join_store(p_store uuid) returns void language sql security definer set search_path = public
as $$ update profiles set store_id = p_store where id = auth.uid() and role = 'manager' and store_id is null $$;
grant execute on function join_store(uuid) to authenticated;

-- Admin-only reset: clears all data, optionally every other account.
-- Every delete has "where true" because Supabase blocks deletes without a WHERE clause.
create function reset_all_data(wipe_accounts boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can reset the data'; end if;
  delete from activity_log where true;
  delete from reports where true;
  delete from losses where true;
  delete from sheet_rows where true;
  delete from supplies where true;
  delete from products where true;
  delete from stores where true;
  if wipe_accounts then delete from auth.users where id <> auth.uid(); end if;
end $$;
grant execute on function reset_all_data(boolean) to authenticated;

-- Row level security
alter table stores enable row level security;       alter table profiles enable row level security;
alter table products enable row level security;     alter table supplies enable row level security;
alter table sheet_rows enable row level security;   alter table losses enable row level security;
alter table reports enable row level security;      alter table activity_log enable row level security;

create policy stores_read   on stores   for select to authenticated using (true);
create policy stores_admin  on stores   for all to authenticated using (is_admin()) with check (is_admin());
create policy prof_read     on profiles for select to authenticated using (id = auth.uid() or is_admin() or (store_id is not null and store_id = my_store()));
create policy prof_admin    on profiles for update to authenticated using (is_admin()) with check (is_admin());
create policy prod_read     on products for select to authenticated using (is_admin() or exists (select 1 from supplies s where s.product_id = products.id and s.store_id = my_store()));
create policy prod_admin    on products for all to authenticated using (is_admin()) with check (is_admin());
create policy sup_read      on supplies for select to authenticated using (is_admin() or store_id = my_store());
create policy sup_admin     on supplies for all to authenticated using (is_admin()) with check (is_admin());
create policy rows_read     on sheet_rows for select to authenticated using (is_admin() or exists (select 1 from supplies s where s.id = supply_id and s.store_id = my_store()));
create policy rows_add      on sheet_rows for insert to authenticated with check (entered_by = auth.uid() and exists (select 1 from supplies s where s.id = supply_id and s.store_id = my_store() and s.sheet_started_at is not null));
create policy loss_read     on losses for select to authenticated using (is_admin() or exists (select 1 from supplies s where s.id = supply_id and s.store_id = my_store()));
create policy loss_add      on losses for insert to authenticated with check (entered_by = auth.uid() and exists (select 1 from supplies s where s.id = supply_id and s.store_id = my_store() and s.sheet_started_at is not null));
create policy rep_read      on reports for select to authenticated using (author = auth.uid() or is_admin());
create policy rep_add       on reports for insert to authenticated with check (author = auth.uid());
create policy rep_admin     on reports for update to authenticated using (is_admin()) with check (is_admin());
create policy log_read      on activity_log for select to authenticated using (actor = auth.uid() or is_admin());
create policy log_add       on activity_log for insert to authenticated with check (actor = auth.uid());

-- Table access (RLS still decides which rows). Without this, PostgREST returns "permission denied".
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on supply_balance to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Live updates
alter publication supabase_realtime add table supplies, sheet_rows, losses, reports, activity_log, products, stores, profiles;
