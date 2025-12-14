-- ============================================================================
-- CHECK TEST DATA STATUS
-- ============================================================================
-- Run this to diagnose what's missing from your test data generation
-- ============================================================================

-- 1. Check if auth users exist (these must be created manually in Dashboard)
SELECT 
  'Auth Users' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 14 THEN '✅ All 14 users exist'
    WHEN COUNT(*) = 0 THEN '❌ No users found - Create users in Supabase Dashboard'
    ELSE '⚠️ Only ' || COUNT(*) || ' users found (expected 14)'
  END as status
FROM auth.users
WHERE email LIKE 'ottilieotto+%'
  AND email != 'ottilieotto@gmail.com';

-- 2. Check if profiles exist (created automatically by triggers when users are created)
SELECT 
  'Profiles' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 14 THEN '✅ All 14 profiles exist'
    WHEN COUNT(*) = 0 THEN '❌ No profiles - Users may not exist or triggers not working'
    ELSE '⚠️ Only ' || COUNT(*) || ' profiles found (expected 14)'
  END as status
FROM profiles
WHERE email LIKE 'ottilieotto+%'
  AND email != 'ottilieotto@gmail.com';

-- 3. Check if profiles have correct data (after running GENERATE_TEST_DATA_BETWEEN.sql)
SELECT 
  'Profiles with Correct Data' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 14 AND COUNT(*) FILTER (WHERE first_name IN ('GTSSF', 'Jackson')) = 14 
      THEN '✅ All profiles have correct names'
    WHEN COUNT(*) = 0 THEN '❌ No profiles to check'
    ELSE '⚠️ Only ' || COUNT(*) || ' profiles have correct data - Run GENERATE_TEST_DATA_BETWEEN.sql'
  END as status
FROM profiles
WHERE email LIKE 'ottilieotto+%'
  AND email != 'ottilieotto@gmail.com'
  AND first_name IN ('GTSSF', 'Jackson')
  AND role IN ('admin', 'coach', 'parent');

-- 4. Check households
SELECT 
  'Households' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 6 THEN '✅ Households exist (' || COUNT(*) || ' found)'
    WHEN COUNT(*) = 0 THEN '❌ No households - Run GENERATE_TEST_DATA_PART2.sql Step 1'
    ELSE '⚠️ Only ' || COUNT(*) || ' households found (expected ~6)'
  END as status
FROM households;

-- 5. Check athletes
SELECT 
  'Athletes' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 12 THEN '✅ Athletes exist (' || COUNT(*) || ' found)'
    WHEN COUNT(*) = 0 THEN '❌ No athletes - Run GENERATE_TEST_DATA_PART2.sql Step 2'
    ELSE '⚠️ Only ' || COUNT(*) || ' athletes found (expected ~12)'
  END as status
FROM athletes;

-- 6. Check coaches
SELECT 
  'Coaches' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ Coaches exist (' || COUNT(*) || ' found)'
    WHEN COUNT(*) = 0 THEN '❌ No coaches - Run GENERATE_TEST_DATA_PART2.sql Step 3'
    ELSE '⚠️ Only ' || COUNT(*) || ' coaches found (expected 4)'
  END as status
FROM coaches;

-- 7. Check coach assignments
SELECT 
  'Coach Assignments' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ Coach assignments exist (' || COUNT(*) || ' found)'
    WHEN COUNT(*) = 0 THEN '❌ No coach assignments - Run GENERATE_TEST_DATA_PART2.sql Step 7'
    ELSE '⚠️ Only ' || COUNT(*) || ' assignments found (expected ~8)'
  END as status
FROM coach_assignments;

-- ============================================================================
-- SUMMARY: What to do next
-- ============================================================================

-- If auth users count = 0:
--   → Go to Supabase Dashboard > Authentication > Users
--   → Create 14 users manually (see GENERATE_TEST_DATA_README.md Step 3)

-- If profiles count = 0 but auth users > 0:
--   → Check database triggers (migration 18 or 35 should have created them)
--   → Profiles should auto-create when users are created

-- If profiles exist but don't have correct names:
--   → Run GENERATE_TEST_DATA_BETWEEN.sql to update profiles

-- If profiles are correct but households/athletes/coaches = 0:
--   → Run GENERATE_TEST_DATA_PART2.sql (or just the missing steps)

