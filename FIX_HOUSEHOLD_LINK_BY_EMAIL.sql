-- Fix household_guardians link using email instead of auth.uid()
-- Replace 'YOUR_EMAIL@example.com' with your actual email address

-- Step 1: Find your user ID and household
WITH user_info AS (
  SELECT 
    p.id as user_id,
    p.email,
    p.club_id,
    h.id as household_id
  FROM profiles p
  LEFT JOIN households h ON h.primary_email = p.email AND h.club_id = p.club_id
  WHERE p.email = 'YOUR_EMAIL@example.com'  -- ⚠️ REPLACE THIS with your email
  LIMIT 1
)
SELECT 
  '1. Your Info' as check_step,
  user_id,
  email,
  club_id,
  household_id,
  CASE 
    WHEN household_id IS NULL THEN '⚠️ No household found - will create one'
    ELSE '✅ Household exists'
  END as status
FROM user_info;

-- Step 2: Create household if it doesn't exist
INSERT INTO households (
  id,
  club_id,
  primary_email,
  phone,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  p.club_id,
  p.email,
  NULL,
  NOW(),
  NOW()
FROM profiles p
WHERE p.email = 'YOUR_EMAIL@example.com'  -- ⚠️ REPLACE THIS
  AND p.club_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM households h
    WHERE h.primary_email = p.email 
      AND h.club_id = p.club_id
  )
RETURNING 'Created household' as status, id, primary_email, club_id;

-- Step 3: Create household_guardians link
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  h.id,
  p.id,
  true
FROM profiles p
INNER JOIN households h ON h.primary_email = p.email AND h.club_id = p.club_id
WHERE p.email = 'YOUR_EMAIL@example.com'  -- ⚠️ REPLACE THIS
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
RETURNING 'Created household_guardians link' as status, household_id, user_id;

-- Step 4: Link athletes to your household
UPDATE athletes a
SET household_id = (
  SELECT hg.household_id
  FROM household_guardians hg
  INNER JOIN profiles p ON p.id = hg.user_id
  WHERE p.email = 'YOUR_EMAIL@example.com'  -- ⚠️ REPLACE THIS
  LIMIT 1
)
WHERE a.club_id = (SELECT club_id FROM profiles WHERE email = 'YOUR_EMAIL@example.com')
  AND a.household_id IS NULL;

-- Step 5: Verify everything is linked correctly
SELECT 
  '✅ Final Verification' as check_step,
  p.email,
  p.club_id as your_club_id,
  hg.household_id as your_household_id,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.club_id as athlete_club_id,
  a.household_id as athlete_household_id,
  CASE 
    WHEN a.household_id = hg.household_id THEN '✅ Match - Ready to checkout!'
    WHEN a.household_id IS NULL THEN '⚠️ Athlete needs household_id'
    ELSE '❌ Mismatch'
  END as status
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN athletes a ON a.household_id = hg.household_id
WHERE p.email = 'YOUR_EMAIL@example.com';  -- ⚠️ REPLACE THIS


