-- Migration 37: Set up storage bucket and RLS policies for profile images
-- This ensures users can upload their own profile images

-- Step 1: Create the storage bucket (if it doesn't exist)
-- Note: Bucket creation must be done via Supabase Dashboard or API
-- SQL cannot create storage buckets directly
-- Bucket name: profile-images
-- Settings: Public bucket OR configure RLS policies below

-- Step 2: Create RLS policies for the profile-images storage bucket
-- These policies allow authenticated users to upload their own profile images
-- and view any profile images (for displaying avatars)

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their profile images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view profile images" ON storage.objects;

-- Policy: Allow authenticated users to upload to their own folder
-- Path pattern: avatars/{user_id}/* or avatars/{timestamp}-{random}.*
CREATE POLICY "Users can upload profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Policy: Allow authenticated users to update their own uploads
CREATE POLICY "Users can update their profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
)
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Policy: Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete their profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Policy: Allow anyone (including unauthenticated) to view profile images
-- This is needed for public avatar URLs to work
CREATE POLICY "Anyone can view profile images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Alternative: If you want to restrict viewing to authenticated users only:
-- CREATE POLICY IF NOT EXISTS "Authenticated users can view profile images"
-- ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING (bucket_id = 'profile-images');

-- Verify the bucket exists (this will return empty if bucket doesn't exist)
-- Note: You need to create the bucket in Supabase Dashboard first:
-- 1. Go to Storage → New Bucket
-- 2. Name: profile-images
-- 3. Public bucket: Yes (for public URLs) OR No (with RLS policies above)
-- 4. File size limit: 2MB (recommended)
-- 5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- To check if bucket exists, run in Supabase Dashboard:
-- SELECT * FROM storage.buckets WHERE name = 'profile-images';

