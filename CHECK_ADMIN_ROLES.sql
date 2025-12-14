-- ============================================================================
-- CHECK ADMIN ROLES
-- ============================================================================
-- Run this to verify that admin users have the correct role
-- ============================================================================

-- Check all admin users and their roles
SELECT 
  email,
  first_name,
  last_name,
  role,
  club_id,
  (SELECT name FROM clubs WHERE id = profiles.club_id) as club_name,
  CASE 
    WHEN role = 'admin' THEN '✅ Correct'
    WHEN role = 'parent' THEN '❌ WRONG - Should be admin'
    ELSE '⚠️ Unexpected role'
  END as status
FROM profiles
WHERE email LIKE '%+admin+%'
  OR email LIKE '%admin%'
ORDER BY 
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'parent' THEN 2
    ELSE 3
  END,
  email;

-- Fix any admins that have the wrong role
UPDATE profiles
SET role = 'admin'::user_role
WHERE email LIKE '%+admin+%'
  AND role != 'admin';

-- Verify the fix
SELECT 
  email,
  first_name,
  last_name,
  role,
  (SELECT name FROM clubs WHERE id = profiles.club_id) as club_name
FROM profiles
WHERE email LIKE '%+admin+%'
ORDER BY email;


