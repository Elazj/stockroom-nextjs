-- Run ONCE in the Supabase SQL editor (new query tab). Adds what the Team page needs.
-- (New projects do not need it: schema.sql already includes it.)

-- 1. Keep each account's email and a disabled flag on the profile
alter table profiles add column if not exists email text;
alter table profiles add column if not exists disabled boolean not null default false;
update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- 2. New accounts store their email too
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'manager');
        s uuid := nullif(new.raw_user_meta_data->>'store_id', '')::uuid;
begin
  if r not in ('admin','manager') then r := 'manager'; end if;
  if r = 'admin' then s := null; end if;
  insert into profiles (id, full_name, email, role, store_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, r, s);
  return new;
end $$;

-- 3. Live updates for the Team page
alter publication supabase_realtime add table profiles;
