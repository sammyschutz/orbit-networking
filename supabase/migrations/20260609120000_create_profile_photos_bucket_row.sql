-- Create the `profile-photos` storage bucket.
--
-- The earlier 20260607122000 migration only created the storage.objects
-- *policies* and assumed the bucket itself would be created manually via the
-- Supabase CLI/Dashboard. That manual step was never run, so every photo
-- upload failed with "Bucket not found" and no profile photo URL was ever
-- valid. Storage buckets are just rows in `storage.buckets`, so we can create
-- the bucket here and keep it reproducible.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
