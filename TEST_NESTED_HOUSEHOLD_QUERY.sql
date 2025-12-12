-- Test the exact nested query that useParentClub uses
-- Replace USER_ID_HERE with the actual user ID that's failing
-- Get user ID with: SELECT id FROM profiles WHERE email = 'YOUR_EMAIL' AND role = 'parent';

-- Test 1: Check if household_guardians record exists
SELECT 
  'Test 1: household_guardians exists?' as test,
  hg.id,
  hg.household_id,
  hg.user_id,
  p.email,
  '✅ Record exists' as status
FROM household_guardians hg
INNER JOIN profiles p ON p.id = hg.user_id
WHERE hg.user_id = 'USER_ID_HERE'  -- ⚠️ REPLACE WITH ACTUAL USER ID
LIMIT 1;

-- Test 2: Check if the household exists
SELECT 
  'Test 2: Household exists?' as test,
  h.id,
  h.club_id,
  h.primary_email,
  hg.user_id,
  '✅ Household exists' as status
FROM household_guardians hg
INNER JOIN households h ON h.id = hg.household_id
WHERE hg.user_id = 'USER_ID_HERE'  -- ⚠️ REPLACE WITH ACTUAL USER ID
LIMIT 1;

-- Test 3: Simulate the nested query (this is what useParentClub does)
-- Note: Supabase's nested select syntax might not work directly in SQL editor
-- But we can test the equivalent
SELECT 
  'Test 3: Nested query equivalent' as test,
  hg.household_id,
  jsonb_build_object(
    'id', h.id,
    'club_id', h.club_id,
    'primary_email', h.primary_email,
    'phone', h.phone,
    'address_line1', h.address_line1,
    'address_line2', h.address_line2,
    'city', h.city,
    'state', h.state,
    'zip_code', h.zip_code,
    'emergency_contact_name', h.emergency_contact_name,
    'emergency_contact_phone', h.emergency_contact_phone
  ) as households
FROM household_guardians hg
LEFT JOIN households h ON h.id = hg.household_id
WHERE hg.user_id = 'USER_ID_HERE'  -- ⚠️ REPLACE WITH ACTUAL USER ID
LIMIT 1;

-- Test 4: Check for RLS blocking (run as the user would see it)
-- This simulates what an authenticated user would see
SELECT 
  'Test 4: What authenticated user sees' as test,
  hg.id as guardian_id,
  hg.household_id,
  CASE 
    WHEN h.id IS NULL THEN '❌ Household not visible (likely RLS issue)'
    ELSE '✅ Household visible'
  END as status,
  h.id as household_id_visible,
  h.primary_email
FROM household_guardians hg
LEFT JOIN households h ON h.id = hg.household_id
WHERE hg.user_id = 'USER_ID_HERE';  -- ⚠️ REPLACE WITH ACTUAL USER ID

-- Test 5: Quick fix - Get the exact user ID and household_id for debugging
SELECT 
  'Test 5: Debug info' as test,
  p.id as user_id,
  p.email,
  p.role,
  p.club_id as profile_club_id,
  hg.id as guardian_id,
  hg.household_id,
  h.id as household_exists,
  h.club_id as household_club_id,
  h.primary_email as household_email,
  CASE 
    WHEN hg.id IS NULL THEN '❌ No household_guardians'
    WHEN h.id IS NULL THEN '❌ household_guardians points to missing household'
    WHEN h.club_id != p.club_id THEN '⚠️ Club ID mismatch'
    ELSE '✅ All looks good'
  END as diagnosis
FROM profiles p
LEFT JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN households h ON h.id = hg.household_id
WHERE p.role = 'parent'
  AND p.email = 'YOUR_EMAIL_HERE'  -- ⚠️ REPLACE WITH ACTUAL EMAIL
LIMIT 1;

