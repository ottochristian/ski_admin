-- Migration 59: Diagnostic query to check profile setup for waiver creation
-- Run this to verify your profile has the correct role and club_id

-- Check current user's profile
SELECT
  'Current User Profile' as check_type,
  id as profile_id,
  email,
  role,
  club_id,
  club_id IN (SELECT id FROM clubs) as club_exists,
  CASE
    WHEN role IN ('admin', 'system_admin') THEN 'Has admin role ✓'
    ELSE 'Missing admin role ✗'
  END as role_check
FROM profiles
WHERE id = auth.uid();

-- Check if any profiles have admin role for your club
SELECT
  'Admin Profiles for Current Club' as check_type,
  COUNT(*) as admin_count
FROM profiles p
WHERE p.role IN ('admin', 'system_admin')
  AND p.club_id IN (
    SELECT club_id FROM profiles WHERE id = auth.uid()
  );

-- Check current user's club
SELECT
  'Current User Club' as check_type,
  c.id as club_id,
  c.name as club_name,
  c.slug
FROM clubs c
WHERE c.id IN (
  SELECT club_id FROM profiles WHERE id = auth.uid()
);

