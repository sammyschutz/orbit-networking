-- Migration: Create profile-photos storage bucket
-- NOTE: Supabase Storage buckets are managed via the Supabase CLI or Dashboard,
-- not via standard SQL DDL. This migration is informational and documents the
-- command to run for setting up the bucket for this project.
--
-- Run this command locally (Supabase CLI must be linked to your project):
--
--   supabase storage create-bucket profile-photos --public
--
-- If you want the bucket to be private, omit --public and use signed URLs
-- when serving files from the client.
--
-- After creating the bucket, set the following env var in your `.env.local`:
--
--   EXPO_PUBLIC_SUPABASE_BUCKET=profile-photos
--
-- The app reads `EXPO_PUBLIC_SUPABASE_BUCKET` at runtime and defaults to
-- `profile-photos` if not provided.

-- Policies to control access to objects in the `profile-photos` bucket.
-- Note: the bucket itself must still be created via the CLI or Dashboard:
--   supabase storage create-bucket profile-photos --public
-- These policy statements operate on the `storage.objects` table which is
-- managed by Supabase Storage and can be applied via `supabase db push`.

-- Allow anyone to view objects in the public bucket
create policy "Photos are publicly viewable" on storage.objects
	for select
	using (bucket_id = 'profile-photos');

-- Allow authenticated users to insert objects into their own folder
create policy "Users can upload own photo" on storage.objects
	for insert
	with check (
		bucket_id = 'profile-photos'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

-- Allow users to update their own objects
create policy "Users can update own photo" on storage.objects
	for update
	using (
		bucket_id = 'profile-photos'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

-- Allow users to delete their own objects
create policy "Users can delete own photo" on storage.objects
	for delete
	using (
		bucket_id = 'profile-photos'
		and auth.uid()::text = (storage.foldername(name))[1]
	);
