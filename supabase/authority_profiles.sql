-- KOINOS authority profiles
-- Run once in Supabase SQL Editor.
-- This fixes: ERROR 42P01 relation "public.profiles" does not exist.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'citizen' check (role in ('citizen', 'authority')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;

-- A signed-in user can read only their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Profile creation is handled by the trigger below. No client-side role assignment.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'citizen');

-- Users may update their display name, but cannot promote themselves.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = 'citizen');

create or replace function public.koinos_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'citizen'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_koinos_profile on auth.users;
create trigger on_auth_user_created_koinos_profile
after insert on auth.users
for each row execute function public.koinos_create_profile();

-- Backfill users that already existed before the profile table was created.
insert into public.profiles (id, display_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(coalesce(u.email, ''), '@', 1)),
  'citizen'
from auth.users u
on conflict (id) do nothing;

-- Promote a trusted authority account manually by replacing the UUID.
-- Never expose this as a client-side operation.
--
-- update public.profiles
-- set role = 'authority', updated_at = now()
-- where id = 'REPLACE_WITH_AUTH_USER_UUID';

-- Verify:
-- select p.id, p.display_name, p.role, u.email
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where p.role = 'authority';
