-- WARNING: do NOT run this file once migration-007.sql has been run. It replaces functions or security rules
-- that migration-007 made company-aware, and would undo the separation between companies.
-- FIX for "Reset all data" not working. Run ONCE in the Supabase SQL editor (new query tab).
-- Supabase refuses a DELETE with no WHERE clause, so the old reset stopped at the first delete.
-- This version adds "where true" to every delete.
create or replace function reset_all_data(wipe_accounts boolean default false) returns void
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
