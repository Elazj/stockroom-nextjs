-- migration-009: repair manager profiles not linked to their company's Team list.
--
-- Run in the Supabase SQL editor after migration-007.sql.
-- Safe to run again.

update public.profiles p
set full_name = coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), p.full_name),
    email = u.email,
    role = 'manager',
    store_id = s.id,
    company_id = s.company_id
from auth.users u
join public.stores s on s.id::text = u.raw_app_meta_data->>'store_id'
where p.id = u.id
  and u.raw_app_meta_data->>'role' = 'manager'
  and p.role = 'manager'
  and s.company_id is not null
  and (p.store_id is distinct from s.id or p.company_id is distinct from s.company_id or p.email is distinct from u.email);

select 'manager profile links repaired' as status;
