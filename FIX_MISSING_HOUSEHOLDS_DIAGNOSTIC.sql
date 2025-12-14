-- ============================================================================
-- FIX MISSING HOUSEHOLDS - Diagnostic and Repair Script
-- ============================================================================
-- This script diagnoses and fixes missing household records for parent accounts
-- Run this in Supabase SQL Editor
-- 
-- IMPORTANT: If you recently changed from households(*) to explicit fields
-- in use-parent-club.ts, the issue might be missing RLS policies on households
-- table. Run migrations/38_add_households_rls.sql FIRST!
-- ============================================================================

-- ============================================================================
-- PART 0: CHECK RLS POLICIES (Most likely issue!)
-- ============================================================================

-- Check if households table has RLS enabled
SELECT 
  '0. RLS Status Check' as check_name,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = false THEN '⚠️ RLS NOT ENABLED - This could be the issue!'
    ELSE '✅ RLS enabled'
  END as status
FROM pg_tables
WHERE tablename IN ('households', 'household_guardians');

-- Check if RLS policies exist for households
SELECT 
  '0. RLS Policies Check' as check_name,
  tablename,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ') as policies,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO POLICIES - Parents cannot read households!'
    ELSE '✅ Policies exist'
  END as status
FROM pg_policies
WHERE tablename IN ('households', 'household_guardians')
GROUP BY tablename;

-- ============================================================================
-- PART 1: DIAGNOSTICS - See what's broken
-- ============================================================================

-- Check 1: Find all parent profiles without household links
SELECT 
  '1. PARENTS WITHOUT HOUSEHOLDS' as check_name,
  COUNT(*) as count,
  string_agg(p.email, ', ') as affected_emails
FROM profiles p
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  );

-- Check 2: Find parent profiles that have household_guardians but no household
SELECT 
  '2. ORPHANED HOUSEHOLD_GUARDIANS' as check_name,
  COUNT(*) as count,
  string_agg(p.email, ', ') as affected_emails
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM households h
    WHERE h.id = hg.household_id
  );

-- Check 3: Find households without guardians (orphaned households)
SELECT 
  '3. ORPHANED HOUSEHOLDS' as check_name,
  COUNT(*) as count,
  string_agg(h.primary_email, ', ') as affected_emails
FROM households h
WHERE NOT EXISTS (
  SELECT 1 
  FROM household_guardians hg
  WHERE hg.household_id = h.id
);

-- Check 4: Find parents with legacy families but no households
SELECT 
  '4. PARENTS WITH FAMILIES BUT NO HOUSEHOLDS' as check_name,
  COUNT(*) as count,
  string_agg(p.email, ', ') as affected_emails
FROM profiles p
INNER JOIN families f ON f.profile_id = p.id
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  );

-- Check 5: Find athletes without household_id
SELECT 
  '5. ATHLETES WITHOUT HOUSEHOLD_ID' as check_name,
  COUNT(*) as count
FROM athletes a
WHERE a.household_id IS NULL;

-- Detailed view: Show all parent profiles and their household status
SELECT 
  '6. DETAILED PARENT STATUS' as check_name,
  p.id as profile_id,
  p.email,
  p.role,
  p.club_id,
  CASE 
    WHEN EXISTS (SELECT 1 FROM household_guardians hg WHERE hg.user_id = p.id) THEN '✅ Has household_guardians'
    ELSE '❌ Missing household_guardians'
  END as guardian_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM household_guardians hg 
      INNER JOIN households h ON h.id = hg.household_id 
      WHERE hg.user_id = p.id
    ) THEN '✅ Has household'
    ELSE '❌ Missing household'
  END as household_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM families f WHERE f.profile_id = p.id) THEN '⚠️ Has legacy family'
    ELSE '✅ No legacy family'
  END as family_status
FROM profiles p
WHERE p.role = 'parent'
ORDER BY p.email;

-- ============================================================================
-- PART 2: FIXES - Automatically repair issues
-- ============================================================================

-- Fix 1: Create households for parents who don't have one
-- (but do have a club_id)
INSERT INTO households (
  id,
  club_id,
  primary_email,
  phone,
  address_line1,
  address_line2,
  city,
  state,
  zip_code,
  emergency_contact_name,
  emergency_contact_phone,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  p.club_id,
  p.email,
  NULL as phone,
  NULL as address_line1,
  NULL as address_line2,
  NULL as city,
  NULL as state,
  NULL as zip_code,
  NULL as emergency_contact_name,
  NULL as emergency_contact_phone,
  NOW(),
  NOW()
FROM profiles p
WHERE p.role = 'parent'
  AND p.club_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM households h
    WHERE h.primary_email = p.email 
      AND h.club_id = p.club_id
  )
RETURNING 
  '✅ Created household' as action,
  id as household_id,
  primary_email,
  club_id;

-- Fix 2: Migrate from legacy families table if households table is empty but families exists
INSERT INTO households (
  id,
  club_id,
  primary_email,
  phone,
  address_line1,
  address_line2,
  city,
  state,
  zip_code,
  emergency_contact_name,
  emergency_contact_phone,
  created_at,
  updated_at
)
SELECT 
  f.id,  -- Keep same ID for easy migration
  COALESCE(f.club_id, p.club_id, (SELECT id FROM clubs LIMIT 1)),
  COALESCE(f.email, p.email),
  f.phone,
  f.address_line1,
  f.address_line2,
  f.city,
  f.state,
  f.zip_code,
  f.emergency_contact_name,
  f.emergency_contact_phone,
  COALESCE(f.created_at, NOW()),
  COALESCE(f.updated_at, NOW())
FROM families f
INNER JOIN profiles p ON f.profile_id = p.id
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM households h
    WHERE h.id = f.id
  )
ON CONFLICT (id) DO NOTHING
RETURNING 
  '✅ Migrated from families' as action,
  id as household_id,
  primary_email,
  club_id;

-- Fix 3: Create household_guardians links for all parents
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  h.id,
  p.id,
  true  -- All are primary guardians initially
FROM profiles p
INNER JOIN households h ON h.primary_email = p.email AND h.club_id = p.club_id
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
ON CONFLICT (household_id, user_id) DO NOTHING
RETURNING 
  '✅ Created household_guardians link' as action,
  household_id,
  user_id,
  (SELECT email FROM profiles WHERE id = user_id) as user_email;

-- Fix 4: Link athletes to households
-- First, try to match by family_id (legacy)
UPDATE athletes a
SET household_id = (
  SELECT h.id
  FROM families f
  INNER JOIN households h ON h.id = f.id
  WHERE f.id = a.family_id
  LIMIT 1
)
WHERE a.household_id IS NULL
  AND a.family_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM families f
    INNER JOIN households h ON h.id = f.id
    WHERE f.id = a.family_id
  );

-- Then, link athletes to their guardian's household if they have a family_id matching a family
UPDATE athletes a
SET household_id = (
  SELECT hg.household_id
  FROM families f
  INNER JOIN household_guardians hg ON hg.user_id = f.profile_id
  WHERE f.id = a.family_id
  LIMIT 1
)
WHERE a.household_id IS NULL
  AND a.family_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM families f
    INNER JOIN household_guardians hg ON hg.user_id = f.profile_id
    WHERE f.id = a.family_id
  );

-- Finally, link orphaned athletes to any household in their club (as last resort)
-- Only if they have no family_id
UPDATE athletes a
SET household_id = (
  SELECT hg.household_id
  FROM household_guardians hg
  INNER JOIN profiles p ON p.id = hg.user_id
  WHERE p.club_id = a.club_id
    AND p.role = 'parent'
  LIMIT 1
)
WHERE a.household_id IS NULL
  AND a.family_id IS NULL
  AND a.club_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM household_guardians hg
    INNER JOIN profiles p ON p.id = hg.user_id
    WHERE p.club_id = a.club_id
  );

-- Fix 5: Ensure athlete club_id matches their household's club_id
UPDATE athletes a
SET club_id = (
  SELECT h.club_id
  FROM households h
  WHERE h.id = a.household_id
)
WHERE a.household_id IS NOT NULL
  AND (
    a.club_id IS NULL
    OR a.club_id != (SELECT club_id FROM households WHERE id = a.household_id)
  );

-- ============================================================================
-- PART 3: VERIFICATION - Check that everything is fixed
-- ============================================================================

-- Verification 1: Count summary
SELECT 
  'VERIFICATION SUMMARY' as check_name,
  (SELECT COUNT(*) FROM profiles WHERE role = 'parent') as total_parent_profiles,
  (SELECT COUNT(DISTINCT hg.user_id) 
   FROM household_guardians hg 
   INNER JOIN profiles p ON p.id = hg.user_id 
   WHERE p.role = 'parent') as parents_with_household_links,
  (SELECT COUNT(*) 
   FROM profiles p 
   WHERE p.role = 'parent' 
   AND NOT EXISTS (
     SELECT 1 FROM household_guardians hg WHERE hg.user_id = p.id
   )) as parents_still_missing_links,
  (SELECT COUNT(*) FROM households) as total_households,
  (SELECT COUNT(*) FROM household_guardians) as total_household_guardians,
  (SELECT COUNT(*) FROM athletes WHERE household_id IS NOT NULL) as athletes_with_households,
  (SELECT COUNT(*) FROM athletes WHERE household_id IS NULL) as athletes_still_orphaned;

-- Verification 2: List any remaining issues
SELECT 
  'REMAINING ISSUES' as check_name,
  p.id as profile_id,
  p.email,
  p.club_id,
  'Missing household link' as issue
FROM profiles p
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
UNION ALL
SELECT 
  'REMAINING ISSUES' as check_name,
  a.id::text as profile_id,
  a.first_name || ' ' || a.last_name as email,
  a.club_id::text as club_id,
  'Athlete missing household_id' as issue
FROM athletes a
WHERE a.household_id IS NULL;

-- Verification 3: Show success cases
SELECT 
  'SUCCESS CASES' as check_name,
  p.email,
  p.club_id,
  h.id as household_id,
  h.primary_email as household_email,
  COUNT(DISTINCT a.id) as athlete_count,
  '✅ Fully linked' as status
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
INNER JOIN households h ON h.id = hg.household_id
LEFT JOIN athletes a ON a.household_id = h.id
WHERE p.role = 'parent'
GROUP BY p.email, p.club_id, h.id, h.primary_email
ORDER BY p.email
LIMIT 10;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- After running this script:
-- 1. Check the verification summary to ensure all parents have household links
-- 2. If there are still issues, check the "REMAINING ISSUES" section
-- 3. Common causes of remaining issues:
--    - Parent profile missing club_id (needs admin to assign)
--    - Email mismatch between profile and household
--    - Database permissions/RLS issues
-- ============================================================================


