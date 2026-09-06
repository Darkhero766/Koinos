-- KOINOS photo storage policy setup
-- Run this in Supabase SQL Editor AFTER creating a PUBLIC bucket named `issue-images`.
-- Bucket settings: public ON, 12 MB max, image/jpeg + image/png + image/webp.
-- The public bucket controls downloads; these RLS policies control uploads.

-- Make this script safe to re-run after experimenting with Supabase's policy templates.
drop policy if exists "KOINOS public issue image downloads" on storage.objects;
drop policy if exists "KOINOS anonymous issue image uploads" on storage.objects;
drop policy if exists "KOINOS user issue image uploads" on storage.objects;
drop policy if exists "KOINOS anonymous issue image metadata" on storage.objects;
drop policy if exists "KOINOS user issue image metadata" on storage.objects;
drop policy if exists "Allow public access to JPG images in a public folder to anonymous users" on storage.objects;

-- Public issue photos are intentionally readable because they are part of the public civic record.
create policy "KOINOS public issue image downloads"
on storage.objects
for select
to public
using (bucket_id = 'issue-images');

-- Signed-out citizens upload into a device-scoped anonymous folder only.
create policy "KOINOS anonymous issue image uploads"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'issue-images'
  and (storage.foldername(name))[1] = 'anonymous'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

-- Signed-in citizens upload only into their own Supabase UID folder.
create policy "KOINOS user issue image uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'issue-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

-- Do not add a second SELECT policy: the public download policy above already covers
-- both anonymous and authenticated users and avoids conflicting dashboard templates.
