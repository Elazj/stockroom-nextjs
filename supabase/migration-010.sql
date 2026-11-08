-- migration-010: lets an admin delete their own account and company (to start over).
-- Run ONCE in the Supabase SQL editor (new query tab). Safe to run again.
--
-- Deletes, for the signed-in admin's company only:
--   the company, its stores, products, supplies, sheet entries, gifts, reports, activity,
--   every store manager account of the company, and the admin's own login.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_company();
  ids uuid[];
begin
  if not public.is_admin() or cid is null then
    raise exception 'Only an admin can delete the account';
  end if;

  -- remember every account of this company before the company row disappears
  select array_agg(id) into ids from public.profiles where company_id = cid;

  -- cascades to stores, products, supplies, sheet_rows, losses, gifts, reports, activity_log
  delete from public.companies where id = cid;

  -- then the logins (their profiles go with them)
  delete from auth.users where id = any (ids);
end $$;

grant execute on function public.delete_my_account() to authenticated;