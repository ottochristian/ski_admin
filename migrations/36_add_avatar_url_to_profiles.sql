-- Migration 36: Add avatar_url to profiles table
-- Allows users to upload and store profile images

-- Step 1: Add avatar_url column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Step 2: Create storage bucket for profile images (if using Supabase Storage)
-- Note: This needs to be run in Supabase Dashboard → Storage → Create bucket
-- Bucket name: profile-images
-- Public: Yes (or configure RLS policies for authenticated access)
-- File size limit: 2MB (or as needed)

-- Step 3: Verify column was added
SELECT 
  'Avatar URL column added' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'avatar_url';
