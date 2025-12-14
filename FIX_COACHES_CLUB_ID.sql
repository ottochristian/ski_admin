-- Fix coaches club_id based on their profile's club

-- This script updates coaches.club_id to match their user profile's club
-- Run this if coaches are showing up in the wrong club's admin portal

-- Step 1: Check current state
SELECT 
  'Before Update' as status,
  c.id,
  c.profile_id,
  c.first_name,
  c.last_name,
  c.club_id as coach_club_id,
  p.club_id as profile_club_id,
  (SELECT slug FROM clubs WHERE id = c.club_id) as coach_club_slug,
  (SELECT slug FROM clubs WHERE id = p.club_id) as profile_club_slug
FROM coaches c
LEFT JOIN profiles p ON p.id = c.profile_id
WHERE c.club_id IS DISTINCT FROM p.club_id
  OR c.club_id IS NULL;

-- Step 2: Update coaches club_id from their profile
UPDATE coaches c
SET club_id = p.club_id
FROM profiles p
WHERE p.id = c.profile_id
  AND c.club_id IS DISTINCT FROM p.club_id;

-- Step 3: Verify the fix
SELECT 
  'After Update - Verification' as status,
  cl.name as club_name,
  COUNT(c.id) as coach_count,
  array_agg(c.first_name || ' ' || c.last_name ORDER BY c.first_name) as coaches
FROM clubs cl
LEFT JOIN coaches c ON c.club_id = cl.id
GROUP BY cl.id, cl.name
ORDER BY cl.name;

-- Step 4: Show all coaches with their club assignment
SELECT 
  'All Coaches With Club' as check_type,
  c.first_name,
  c.last_name,
  c.club_id,
  cl.name as club_name,
  cl.slug as club_slug,
  p.email as user_email
FROM coaches c
JOIN clubs cl ON cl.id = c.club_id
LEFT JOIN profiles p ON p.id = c.profile_id
ORDER BY cl.name, c.first_name;

