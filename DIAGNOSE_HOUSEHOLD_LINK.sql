-- Diagnostic query to find the issue
-- Run this in Supabase SQL Editor

-- Check 1: Your profile
SELECT 
  '1. Your Profile' as check_step,
  id as user_id,
  email,
  role,
  club_id
FROM profiles
WHERE id = auth.uid();

-- Check 2: Do you have a household_guardians entry?
SELECT 
  '2. Household Guardian Link' as check_step,
  hg.user_id,
  hg.household_id,
  hg.is_primary
FROM household_guardians hg
WHERE hg.user_id = auth.uid();

-- Check 3: What households exist for your email?
SELECT 
  '3. Households for your email' as check_step,
  h.id as household_id,
  h.club_id,
  h.primary_email
FROM households h
INNER JOIN profiles p ON p.email = h.primary_email AND p.club_id = h.club_id
WHERE p.id = auth.uid();

-- Check 4: Your athletes (if any exist)
SELECT 
  '4. Your Athletes' as check_step,
  a.id as athlete_id,
  a.first_name,
  a.last_name,
  a.household_id,
  a.family_id,
  a.club_id
FROM athletes a
WHERE a.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid());

-- Check 5: Manual fix - Create household_guardians link
-- This will create the link if it doesn't exist
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  h.id,
  p.id,
  true
FROM profiles p
INNER JOIN households h ON h.primary_email = p.email AND h.club_id = p.club_id
WHERE p.id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
RETURNING *;

-- After running the INSERT above, verify it worked:
SELECT 
  '✅ Verification - After Fix' as check_step,
  p.email,
  hg.household_id,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.household_id,
  CASE 
    WHEN a.household_id = hg.household_id THEN '✅ Match'
    WHEN a.household_id IS NULL THEN '⚠️ Athlete has no household'
    ELSE '❌ Mismatch'
  END as status
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN athletes a ON a.household_id = hg.household_id
WHERE p.id = auth.uid();

