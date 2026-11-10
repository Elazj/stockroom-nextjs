-- migration-012: enable admins to correct their company name in General Settings.
--
-- Run in the Supabase SQL editor after migration-011.sql.
-- Safe to run again. Recreates the company settings function without changing existing data.

create or replace function public.update_company_settings(
  p_name text default null,
  p_settings jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_company();
  nm text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 80);
begin
  if not public.is_admin() or cid is null then
    raise exception 'Only an admin can change the company settings';
  end if;

  if p_name is not null then
    if char_length(nm) < 2 then
      raise exception 'Enter the company or business name';
    end if;
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

select 'company name editing enabled in General Settings' as status;
