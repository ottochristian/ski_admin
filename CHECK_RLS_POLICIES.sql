-- Diagnostic script to check current RLS policies on households and household_guardians
-- This will help us see what policies actually exist and their definitions

-- Check all policies on households table
SELECT 
  'households policies' as table_name,
  policyname,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'households'
ORDER BY policyname;

-- Check all policies on household_guardians table
SELECT 
  'household_guardians policies' as table_name,
  policyname,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'household_guardians'
ORDER BY policyname;

-- Get the actual policy definition from pg_policies (system view)
-- This shows the full USING clause that might be causing recursion
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('households', 'household_guardians')
ORDER BY tablename, policyname;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('households', 'household_guardians');

