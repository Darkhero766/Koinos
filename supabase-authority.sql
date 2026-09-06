-- KOINOS authority setup
-- 1) Run supabase-core.sql first.
-- 2) Find the authority's Supabase Auth user id:
--    select id, email from auth.users order by created_at desc;
-- 3) Promote only trusted staff by replacing the UUID below.

insert into public.profiles (id, display_name, role)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1)), 'authority'
from auth.users
where id = 'cce72e73-0835-4c56-84f5-ba0688edc5e5'
on conflict (id) do update set role = 'authority', updated_at = now();

-- Verify:
-- select p.id, p.display_name, p.role, u.email
-- from public.profiles p join auth.users u on u.id = p.id
-- where p.role = 'authority';
