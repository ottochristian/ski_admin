-- Migration 32: Fix missing household_guardians links for existing parents
-- This ensures all parents with profiles have proper household links

-- Step 1: Create households for parents who don't have one
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
ON CONFLICT DO NOTHING;

-- Step 2: Link parents to their households via household_guardians
INSERT INTO household_guardians (household_id, user_id, is_primary)
SELECT 
  h.id,
  p.id,
  true
FROM profiles p
INNER JOIN households h ON h.primary_email = p.email AND h.club_id = p.club_id
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = p.id
  )
ON CONFLICT (household_id, user_id) DO NOTHING;

-- Step 3: Link athletes to households if they're missing household_id
UPDATE athletes a
SET household_id = (
  SELECT hg.household_id
  FROM household_guardians hg
  INNER JOIN profiles p ON p.id = hg.user_id
  WHERE p.club_id = a.club_id
    AND (
      -- Match by family_id if it exists
      EXISTS (
        SELECT 1 
        FROM families f
        WHERE f.id = a.family_id
          AND f.profile_id = hg.user_id
      )
      OR
      -- Match by club_id if family_id doesn't exist
      a.family_id IS NULL
    )
  LIMIT 1
)
WHERE a.household_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.club_id = a.club_id
      AND p.role = 'parent'
  );

-- Step 4: Update athlete club_id to match their household's club
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

-- Verify the fix
SELECT 
  'Fix complete' as status,
  (SELECT COUNT(*) FROM profiles WHERE role = 'parent') as total_parents,
  (SELECT COUNT(DISTINCT hg.user_id) 
   FROM household_guardians hg 
   INNER JOIN profiles p ON p.id = hg.user_id 
   WHERE p.role = 'parent') as parents_with_households,
  (SELECT COUNT(*) 
   FROM athletes 
   WHERE household_id IS NOT NULL) as athletes_with_households,
  (SELECT COUNT(*) 
   FROM athletes a
   INNER JOIN household_guardians hg ON hg.household_id = a.household_id
   INNER JOIN profiles p ON p.id = hg.user_id
   WHERE p.role = 'parent') as linked_athletes;
