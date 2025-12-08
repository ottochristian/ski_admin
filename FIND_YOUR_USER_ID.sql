-- Quick query to find your user ID
-- Run this first to get your user information

-- Option 1: Find by email (replace with your email)
SELECT 
  id as user_id,
  email,
  role,
  club_id
FROM profiles
WHERE email = 'YOUR_EMAIL@example.com';  -- ⚠️ Replace with your actual email

-- Option 2: List all parent profiles to find yours
SELECT 
  id as user_id,
  email,
  role,
  club_id
FROM profiles
WHERE role = 'parent'
ORDER BY email;

-- Option 3: If you know your user ID, check if household_guardians exists
-- Replace 'YOUR_USER_ID' with the actual UUID from above
SELECT 
  hg.*,
  h.primary_email,
  h.club_id as household_club_id
FROM household_guardians hg
INNER JOIN households h ON h.id = hg.household_id
WHERE hg.user_id = 'YOUR_USER_ID'::uuid;  -- ⚠️ Replace with your user ID
