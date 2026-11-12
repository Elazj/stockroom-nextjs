-- migration-013: user profile pictures.
-- Run in the Supabase SQL editor after migration-012.sql. Safe to run again.

alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatar_read_own on storage.objects;
create policy avatar_read_own on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatar_upload_own on storage.objects;
create policy avatar_upload_own on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatar_replace_own on storage.objects;
create policy avatar_replace_own on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.update_my_avatar(p_avatar_path text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_avatar_path is not null and p_avatar_path <> (auth.uid()::text || '/avatar') then
    raise exception 'Invalid profile picture path';
  end if;
  update public.profiles set avatar_path = p_avatar_path where id = auth.uid();
end $$;

grant execute on function public.update_my_avatar(text) to authenticated;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_profile_email();
