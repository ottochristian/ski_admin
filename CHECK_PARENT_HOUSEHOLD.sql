-- Check parent household setup
-- Run this to see what's missing for a specific parent user

-- 1. Find the parent profile
SELECT 
  'Parent Profile' as check_type,
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.club_id,
  c.name as club_name
FROM profiles p
LEFT JOIN clubs c ON c.id = p.club_id
WHERE p.role = 'parent'
ORDER BY p.created_at DESC
LIMIT 5;

-- 2. Check household_guardians link
SELECT 
  'Household Guardian Links' as check_type,
  hg.household_id,
  hg.user_id,
  p.email,
  p.first_name,
  p.last_name
FROM household_guardians hg
JOIN profiles p ON p.id = hg.user_id
WHERE p.role = 'parent'
ORDER BY hg.created_at DESC
LIMIT 5;

-- 3. Check households
SELECT 
  'Households' as check_type,
  h.id,
  h.name,
  h.club_id,
  c.name as club_name,
  (SELECT COUNT(*) FROM household_guardians WHERE household_id = h.id) as guardian_count,
  (SELECT COUNT(*) FROM athletes WHERE household_id = h.id) as athlete_count
FROM households h
LEFT JOIN clubs c ON c.id = h.club_id
ORDER BY h.created_at DESC
LIMIT 10;

-- 4. For a specific parent email, show everything
-- REPLACE 'your-parent-email@example.com' with the actual parent email
SELECT 
  'Specific Parent Details' as check_type,
  p.id as profile_id,
  p.email,
  p.first_name,
  p.last_name,
  p.club_id,
  c.name as club_name,
  hg.household_id,
  h.name as household_name
FROM profiles p
LEFT JOIN clubs c ON c.id = p.club_id
LEFT JOIN household_guardians hg ON hg.user_id = p.id
LEFT JOIN households h ON h.id = hg.household_id
WHERE p.email = 'REPLACE_WITH_PARENT_EMAIL@example.com'  -- ⚠️ REPLACE THIS
  AND p.role = 'parent';

-- 5. Count stats
SELECT 
  'Statistics' as check_type,
  (SELECT COUNT(*) FROM profiles WHERE role = 'parent') as total_parents,
  (SELECT COUNT(*) FROM households) as total_households,
  (SELECT COUNT(*) FROM household_guardians) as total_guardian_links,
  (SELECT COUNT(*) FROM profiles p 
   LEFT JOIN household_guardians hg ON hg.user_id = p.id 
   WHERE p.role = 'parent' AND hg.household_id IS NULL) as parents_without_household;
