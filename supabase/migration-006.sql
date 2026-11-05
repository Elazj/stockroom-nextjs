-- Offline sync: each device-written entry keeps a client_id so a retry cannot insert twice.
-- Run ONCE in the Supabase SQL editor (new query tab). Safe if the columns already exist.

alter table public.sheet_rows add column if not exists client_id uuid;
alter table public.losses add column if not exists client_id uuid;

create unique index if not exists sheet_rows_client_id on public.sheet_rows (client_id) where client_id is not null;
create unique index if not exists losses_client_id on public.losses (client_id) where client_id is not null;
