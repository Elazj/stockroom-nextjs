-- Run ONCE in the Supabase SQL editor for existing projects to enable the admin reset action.
create or replace function reset_all_data(wipe_accounts boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  truncate activity_log, reports, losses, sheet_rows, supplies, products restart identity cascade;
  delete from stores;
  if wipe_accounts then delete from auth.users where id <> auth.uid(); end if;
end $$;
revoke all on function reset_all_data(boolean) from public, anon;
grant execute on function reset_all_data(boolean) to authenticated;
