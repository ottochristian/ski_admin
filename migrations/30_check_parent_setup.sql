-- Diagnostic query to check if a parent user can create registrations
-- Replace 'YOUR_USER_ID' with the actual user ID (from auth.users or profiles.id)

-- Check 1: Does the user have a profile with parent role?
SELECT 
  'Profile Check' as check_type,
  id,
  email,
  role,
  club_id
FROM profiles
WHERE id = auth.uid(); -- Or replace with specific user ID

-- Check 2: Is the user linked to a household?
SELECT 
  'Household Guardian Check' as check_type,
  hg.user_id,
  hg.household_id,
  h.name as household_name
FROM household_guardians hg
LEFT JOIN households h ON h.id = hg.household_id
WHERE hg.user_id = auth.uid(); -- Or replace with specific user ID

-- Check 3: Does the user have athletes in their household?
SELECT 
  'Athletes Check' as check_type,
  a.id as athlete_id,
  a.first_name,
  a.last_name,
  a.household_id,
  a.club_id,
  hg.user_id as guardian_user_id
FROM athletes a
INNER JOIN household_guardians hg ON hg.household_id = a.household_id
WHERE hg.user_id = auth.uid(); -- Or replace with specific user ID

-- Check 4: Can the user see athletes via RLS?
-- This will only return rows if RLS policies allow it
SELECT 
  'RLS Athletes Check' as check_type,
  id,
  first_name,
  last_name,
  household_id,
  club_id
FROM athletes
LIMIT 10;

-- Check 5: Check if registrations RLS policies exist
SELECT 
  'RLS Policies Check' as check_type,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'registrations'
ORDER BY policyname;



