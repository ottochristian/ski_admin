-- Check if households table has RLS enabled and what policies exist
SELECT 
  'RLS Status for households' as check_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'households';

-- Check existing RLS policies on households
SELECT 
  'Existing RLS Policies on households' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'households';

-- Check RLS policies on household_guardians
SELECT 
  'Existing RLS Policies on household_guardians' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'household_guardians';
