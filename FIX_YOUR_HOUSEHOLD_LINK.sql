-- Quick fix: Create household_guardians link for your user
-- This will link you to your household so the RLS policy works

-- Step 1: Create the household_guardians link
-- This matches your profile to your household by email and club_id
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
RETURNING 
  'Created household_guardians link' as status,
  household_id,
  user_id;

-- Step 2: Link athletes to your household if they're missing household_id
UPDATE athletes a
SET household_id = (
  SELECT hg.household_id
  FROM household_guardians hg
  WHERE hg.user_id = auth.uid()
  LIMIT 1
)
WHERE a.club_id = (SELECT club_id FROM profiles WHERE id = auth.uid())
  AND a.household_id IS NULL;

-- Step 3: Verify the fix worked
SELECT 
  '✅ Verification' as check_step,
  p.email,
  p.club_id as your_club_id,
  hg.household_id as your_household_id,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.household_id as athlete_household_id,
  CASE 
    WHEN a.household_id = hg.household_id THEN '✅ Match - Ready to checkout!'
    WHEN a.household_id IS NULL THEN '⚠️ Athlete needs household_id'
    ELSE '❌ Mismatch'
  END as status
FROM profiles p
INNER JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN athletes a ON a.household_id = hg.household_id
WHERE p.id = auth.uid();
