-- Test Script: Verify RLS Automatically Filters Data by Club
-- This script tests that RLS policies properly scope data without manual club_id filtering
-- Run this as different users (admin, parent, coach) to verify access control

-- ============================================
-- TEST 1: Verify RLS is Enabled
-- ============================================
SELECT 
  'RLS Status Check' as test_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('programs', 'athletes', 'coaches', 'registrations', 'sub_programs', 'groups', 'seasons')
ORDER BY tablename;

-- ============================================
-- TEST 2: Admin User - Should See Only Their Club's Data
-- ============================================
-- Prerequisites: 
-- 1. Log in as an admin user (get their user ID from auth.users)
-- 2. Note their club_id from profiles table
-- 3. Verify there are other clubs with data

-- Example: Test as admin with id = 'YOUR_ADMIN_USER_ID'
-- Uncomment and replace with actual user ID:
/*
SET LOCAL request.jwt.claim.sub = 'YOUR_ADMIN_USER_ID';

-- Test programs query (should only return admin's club programs)
SELECT 
  'Admin Programs Test' as test_name,
  COUNT(*) as programs_visible,
  COUNT(DISTINCT club_id) as clubs_visible,
  array_agg(DISTINCT club_id) as club_ids
FROM programs;

-- Should see: programs_visible = only their club, clubs_visible = 1, club_ids = [their_club_id]

-- Test athletes query
SELECT 
  'Admin Athletes Test' as test_name,
  COUNT(*) as athletes_visible,
  COUNT(DISTINCT club_id) as clubs_visible
FROM athletes;

-- Test coaches query
SELECT 
  'Admin Coaches Test' as test_name,
  COUNT(*) as coaches_visible,
  COUNT(DISTINCT club_id) as clubs_visible
FROM coaches;
*/

-- ============================================
-- TEST 3: Parent User - Should See Only Their Household's Data
-- ============================================
-- Prerequisites:
-- 1. Log in as a parent user
-- 2. Verify parent has household_guardians link

/*
SET LOCAL request.jwt.claim.sub = 'YOUR_PARENT_USER_ID';

-- Test athletes query (should only return athletes in parent's household)
SELECT 
  'Parent Athletes Test' as test_name,
  COUNT(*) as athletes_visible,
  COUNT(DISTINCT household_id) as households_visible
FROM athletes;

-- Should see: athletes_visible = only their household's athletes, households_visible = 1

-- Test registrations query
SELECT 
  'Parent Registrations Test' as test_name,
  COUNT(*) as registrations_visible
FROM registrations;
*/

-- ============================================
-- TEST 4: Coach User - Should See Only Assigned Programs
-- ============================================
-- Prerequisites:
-- 1. Log in as a coach user
-- 2. Verify coach has coach_assignments

/*
SET LOCAL request.jwt.claim.sub = 'YOUR_COACH_USER_ID';

-- Test programs query (should only return assigned programs)
SELECT 
  'Coach Programs Test' as test_name,
  COUNT(*) as programs_visible
FROM programs;

-- Test sub_programs query
SELECT 
  'Coach Sub-Programs Test' as test_name,
  COUNT(*) as sub_programs_visible
FROM sub_programs;
*/

-- ============================================
-- TEST 5: Verify Cross-Club Data Leakage Prevention
-- ============================================
-- This test verifies that users cannot see data from other clubs

-- Step 1: Get two different club IDs
DO $$
DECLARE
  club1_id UUID;
  club2_id UUID;
  admin1_id UUID;
  admin2_id UUID;
  program1_id UUID;
  program2_id UUID;
  programs_visible_to_admin1 INTEGER;
  programs_visible_to_admin2 INTEGER;
BEGIN
  -- Get two different clubs
  SELECT id INTO club1_id FROM clubs LIMIT 1;
  SELECT id INTO club2_id FROM clubs WHERE id != club1_id LIMIT 1;
  
  -- Get admins from each club
  SELECT id INTO admin1_id FROM profiles WHERE club_id = club1_id AND role = 'admin' LIMIT 1;
  SELECT id INTO admin2_id FROM profiles WHERE club_id = club2_id AND role = 'admin' LIMIT 1;
  
  -- Get programs from each club
  SELECT id INTO program1_id FROM programs WHERE club_id = club1_id LIMIT 1;
  SELECT id INTO program2_id FROM programs WHERE club_id = club2_id LIMIT 1;
  
  IF club1_id IS NULL OR club2_id IS NULL THEN
    RAISE NOTICE 'Need at least 2 clubs for this test';
    RETURN;
  END IF;
  
  IF admin1_id IS NULL OR admin2_id IS NULL THEN
    RAISE NOTICE 'Need admins in both clubs for this test';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Test Setup:';
  RAISE NOTICE '  Club 1 ID: %', club1_id;
  RAISE NOTICE '  Club 2 ID: %', club2_id;
  RAISE NOTICE '  Admin 1 ID: %', admin1_id;
  RAISE NOTICE '  Admin 2 ID: %', admin2_id;
  RAISE NOTICE '';
  RAISE NOTICE 'MANUAL TEST REQUIRED:';
  RAISE NOTICE '1. Log in as Admin 1 and query programs - should only see Club 1 programs';
  RAISE NOTICE '2. Log in as Admin 2 and query programs - should only see Club 2 programs';
  RAISE NOTICE '3. Verify Admin 1 cannot see Program 2 ID: %', program2_id;
  RAISE NOTICE '4. Verify Admin 2 cannot see Program 1 ID: %', program1_id;
END $$;

-- ============================================
-- TEST 6: Count RLS Policies Per Table
-- ============================================
SELECT 
  'RLS Policies Count' as test_name,
  tablename,
  COUNT(*) as policy_count,
  array_agg(policyname ORDER BY policyname) as policies
FROM pg_policies
WHERE tablename IN (
  'programs', 
  'sub_programs', 
  'groups', 
  'athletes', 
  'coaches', 
  'registrations', 
  'seasons',
  'coach_assignments',
  'households',
  'household_guardians'
)
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- TEST 7: Verify All Tables Have RLS Enabled
-- ============================================
SELECT 
  'Tables Missing RLS' as test_name,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'programs', 
    'sub_programs', 
    'groups', 
    'athletes', 
    'coaches', 
    'registrations', 
    'seasons',
    'coach_assignments'
  )
  AND NOT rowsecurity
ORDER BY tablename;

-- Should return 0 rows (all tables should have RLS enabled)
