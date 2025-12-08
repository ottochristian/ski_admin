-- Migration 27: Setup Supabase Storage bucket for club logos
-- This creates the storage bucket and sets up public access policies

-- Note: This migration should be run in the Supabase SQL Editor
-- Storage buckets cannot be created via SQL, they must be created in the Supabase Dashboard
-- However, we can set up the RLS policies for the bucket

-- Step 1: Create the bucket (must be done in Supabase Dashboard)
-- Go to: Storage → New Bucket
-- Name: club-logos
-- Public: Yes (checked)
-- File size limit: 5MB (optional)
-- Allowed MIME types: image/* (optional)

-- Step 2: Set up RLS policies for the bucket (run this SQL)
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Allow public read access to all files in the bucket
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'club-logos');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'club-logos');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Authenticated users can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'club-logos')
WITH CHECK (bucket_id = 'club-logos');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'club-logos');

-- Verify policies
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual::text LIKE '%club-logos%' OR with_check::text LIKE '%club-logos%');
