-- Run once in Supabase SQL Editor.
-- The frontend uses the `issue-images` bucket.
-- Make the bucket PUBLIC for public issue photos, then run these policies.

-- If the bucket does not exist, create it in Storage > New bucket:
-- name: issue-images
-- public: ON
-- file size limit: 12 MB
-- allowed MIME types: image/jpeg, image/png, image/webp

-- Public downloads are intentional because issue photos are part of the public civic record.
create policy "KOINOS public issue image downloads"
on storage.objects
for select
to public
using (bucket_id = 'issue-images');

-- Signed-out visitors can upload only into their device-scoped anonymous folder.
create policy "KOINOS anonymous issue image uploads"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'issue-images'
  and (storage.foldername(name))[1] = 'anonymous'
  and storage.extension(name) in ('jpg','jpeg','png','webp')
);

-- Signed-in users can upload only into their own UID folder.
create policy "KOINOS user issue image uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'issue-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) in ('jpg','jpeg','png','webp')
);

-- Supabase Storage can need SELECT on the object metadata during upload.
-- These policies keep the same folder restriction while allowing that metadata read.
create policy "KOINOS anonymous issue image metadata"
on storage.objects
for select
to anon
using (
  bucket_id = 'issue-images'
  and (storage.foldername(name))[1] = 'anonymous'
);

create policy "KOINOS user issue image metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'issue-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
