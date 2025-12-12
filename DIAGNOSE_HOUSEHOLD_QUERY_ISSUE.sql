-- ============================================================================
-- DIAGNOSE HOUSEHOLD QUERY ISSUE
-- ============================================================================
-- This script helps diagnose why useParentClub might fail even when
-- household_guardians records exist
-- ============================================================================

-- Check 1: Find household_guardians with missing household records (orphaned references)
SELECT 
  'ORPHANED HOUSEHOLD_GUARDIANS' as issue_type,
  hg.id as guardian_id,
  hg.user_id,
  hg.household_id,
  p.email as user_email,
  p.role,
  '❌ household_guardians points to non-existent household' as problem
FROM household_guardians hg
INNER JOIN profiles p ON p.id = hg.user_id
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM households h
    WHERE h.id = hg.household_id
  );

-- Check 2: Test the exact query that useParentClub uses (simulating for a specific user)
-- Replace 'USER_EMAIL_HERE' with the actual parent email that's failing
SELECT 
  'QUERY TEST - Replace user_id below' as note,
  hg.household_id,
  h.id as household_exists,
  h.club_id,
  h.primary_email,
  p.email as profile_email,
  'This simulates what useParentClub queries' as explanation
FROM profiles p
LEFT JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN households h ON h.id = hg.household_id
WHERE p.role = 'parent'
  AND p.email = 'USER_EMAIL_HERE'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
LIMIT 1;

-- Check 3: Find RLS policy issues - Check if household records exist but are blocked by RLS
-- This query uses service role (bypass RLS) to see if records exist
-- Note: This might not work depending on your setup, but helps identify RLS issues
SELECT 
  'HOUSEHOLD ACCESS CHECK' as check_name,
  COUNT(*) as total_households,
  COUNT(DISTINCT hg.household_id) as households_referenced_by_guardians,
  COUNT(*) - COUNT(DISTINCT hg.household_id) as potentially_orphaned_households
FROM households h
FULL OUTER JOIN household_guardians hg ON hg.household_id = h.id;

-- Check 4: Check for email/club_id mismatches that could cause join failures
SELECT 
  'EMAIL/CLUB MISMATCH CHECK' as issue_type,
  p.id as profile_id,
  p.email as profile_email,
  p.club_id as profile_club_id,
  hg.household_id,
  h.primary_email as household_email,
  h.club_id as household_club_id,
  CASE 
    WHEN p.email != h.primary_email THEN '⚠️ Email mismatch'
    WHEN p.club_id != h.club_id THEN '⚠️ Club ID mismatch'
    ELSE '✅ Match'
  END as status
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
INNER JOIN households h ON h.id = hg.household_id
WHERE p.role = 'parent'
  AND (p.email != h.primary_email OR p.club_id != h.club_id);

-- Check 5: Test the nested select query (this is what useParentClub actually runs)
-- Replace the user_id with an actual parent user_id
SELECT 
  'NESTED QUERY TEST' as test_name,
  hg.household_id,
  hg.households as nested_household_data,
  CASE 
    WHEN hg.households IS NULL THEN '❌ Nested select returned NULL'
    WHEN (hg.households::jsonb)->>'id' IS NULL THEN '❌ Household ID is NULL in nested data'
    ELSE '✅ Nested select worked'
  END as status
FROM (
  SELECT 
    household_id,
    jsonb_build_object(
      'id', h.id,
      'club_id', h.club_id,
      'primary_email', h.primary_email,
      'phone', h.phone,
      'address', h.address,
      'address_line1', h.address_line1,
      'address_line2', h.address_line2,
      'city', h.city,
      'state', h.state,
      'zip_code', h.zip_code,
      'emergency_contact_name', h.emergency_contact_name,
      'emergency_contact_phone', h.emergency_contact_phone
    ) as households
  FROM household_guardians hg
  INNER JOIN households h ON h.id = hg.household_id
  WHERE hg.user_id = (SELECT id FROM profiles WHERE email = 'USER_EMAIL_HERE' AND role = 'parent' LIMIT 1)
  LIMIT 1
) hg;

-- Check 6: Simple query to verify basic household access (no nesting)
SELECT 
  'SIMPLE QUERY TEST' as test_name,
  p.email,
  hg.household_id,
  h.id as household_id_verified,
  h.primary_email,
  h.club_id,
  '✅ If household_id_verified is NULL, the household record is missing' as note
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN households h ON h.id = hg.household_id
WHERE p.role = 'parent'
ORDER BY p.email
LIMIT 10;

-- Check 7: Most likely issue - household_guardians exists but query fails due to RLS
-- This shows which parents have guardian records but might have RLS issues
SELECT 
  'PARENT HOUSEHOLD STATUS' as check_name,
  p.email,
  p.club_id as profile_club_id,
  CASE 
    WHEN hg.id IS NULL THEN '❌ No household_guardians record'
    WHEN h.id IS NULL THEN '❌ household_guardians points to missing household'
    WHEN h.club_id != p.club_id THEN '⚠️ Club ID mismatch'
    ELSE '✅ OK'
  END as status,
  hg.household_id,
  h.id as household_exists,
  h.club_id as household_club_id
FROM profiles p
LEFT JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN households h ON h.id = hg.household_id
WHERE p.role = 'parent'
ORDER BY 
  CASE 
    WHEN hg.id IS NULL THEN 1
    WHEN h.id IS NULL THEN 2
    ELSE 3
  END,
  p.email;

