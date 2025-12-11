-- ============================================================================
-- GENERATE TEST DATA - BETWEEN Parts 1 & 2: Update Profiles
-- ============================================================================
-- Run this AFTER creating users in Supabase Dashboard (Step 3)
-- But BEFORE running Part 2
-- 
-- This updates the automatically-created profiles with correct:
-- - First name (club name)
-- - Last name (role + identifier)
-- - Role (admin, coach, parent)
-- - Club ID (GTSSF or Jackson)
-- ============================================================================

-- Step 1: Update profiles with correct data based on email pattern
UPDATE profiles p
SET
  first_name = CASE
    WHEN p.email LIKE '%+gtssf+%' THEN 'GTSSF'
    WHEN p.email LIKE '%+jackson+%' THEN 'Jackson'
    ELSE p.first_name
  END,
  last_name = CASE
    WHEN p.email LIKE '%+admin+a@gmail.com' THEN 'Admin A'
    WHEN p.email LIKE '%+admin+b@gmail.com' THEN 'Admin B'
    WHEN p.email LIKE '%+coach+a@gmail.com' THEN 'Coach A'
    WHEN p.email LIKE '%+coach+b@gmail.com' THEN 'Coach B'
    WHEN p.email LIKE '%+parent+a@gmail.com' THEN 'Parent A'
    WHEN p.email LIKE '%+parent+b@gmail.com' THEN 'Parent B'
    WHEN p.email LIKE '%+parent+c@gmail.com' THEN 'Parent C'
    ELSE p.last_name
  END,
  role = CASE
    WHEN p.email LIKE '%+admin+%' THEN 'admin'::user_role
    WHEN p.email LIKE '%+coach+%' THEN 'coach'::user_role
    WHEN p.email LIKE '%+parent+%' THEN 'parent'::user_role
    ELSE p.role
  END,
  club_id = CASE
    WHEN p.email LIKE '%+gtssf+%' THEN (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1)
    WHEN p.email LIKE '%+jackson+%' THEN (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1)
    ELSE p.club_id
  END
WHERE p.email LIKE 'ottilieotto+%'
  AND p.email != 'ottilieotto@gmail.com';

-- Step 2: Verify profiles were updated correctly
SELECT 
  email,
  first_name,
  last_name,
  role,
  club_id,
  (SELECT name FROM clubs WHERE id = profiles.club_id) as club_name
FROM profiles
WHERE email LIKE 'ottilieotto+%'
ORDER BY 
  CASE 
    WHEN email LIKE '%+gtssf+%' THEN 1
    WHEN email LIKE '%+jackson+%' THEN 2
  END,
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'coach' THEN 2
    WHEN 'parent' THEN 3
  END,
  email;

-- Expected output: 14 rows with correct names, roles, and club assignments
