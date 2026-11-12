-- migration-014: use unique, cache-safe paths for profile picture replacements.
-- Run in the Supabase SQL editor after migration-013.sql. Safe to run again.

create or replace function public.update_my_avatar(p_avatar_path text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_avatar_path is not null
     and p_avatar_path <> (auth.uid()::text || '/avatar')
     and p_avatar_path !~ ('^' || auth.uid()::text || '/avatar/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') then
    raise exception 'Invalid profile picture path';
  end if;
  if p_avatar_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'avatars' and name = p_avatar_path
  ) then
    raise exception 'Profile picture must be uploaded before it is saved';
  end if;
  update public.profiles set avatar_path = p_avatar_path where id = auth.uid();
end $$;

grant execute on function public.update_my_avatar(text) to authenticated;
