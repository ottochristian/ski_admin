-- Migration 21: Fix missing households for existing parent profiles
-- This creates households for parents who have profiles but no household

-- Find parents without households
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
ON CONFLICT DO NOTHING;

-- Link parents to their households via household_guardians
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

-- Verify the fix
SELECT 
  'Household creation complete' as status,
  (SELECT COUNT(*) FROM profiles WHERE role = 'parent') as total_parents,
  (SELECT COUNT(DISTINCT hg.user_id) FROM household_guardians hg 
   INNER JOIN profiles p ON p.id = hg.user_id 
   WHERE p.role = 'parent') as parents_with_households,
  (SELECT COUNT(*) FROM profiles p 
   WHERE p.role = 'parent' 
   AND NOT EXISTS (
     SELECT 1 FROM household_guardians hg WHERE hg.user_id = p.id
   )) as parents_without_households;
