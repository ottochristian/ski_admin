-- Fix athletes club_id based on their household's club

-- This script updates athletes.club_id to match their household's club
-- Run this if athletes are showing up in the wrong club's admin portal

-- Step 1: Check current state
SELECT 
  'Before Update' as status,
  a.id,
  a.first_name,
  a.last_name,
  a.club_id as athlete_club_id,
  h.club_id as household_club_id,
  (SELECT slug FROM clubs WHERE id = a.club_id) as athlete_club_slug,
  (SELECT slug FROM clubs WHERE id = h.club_id) as household_club_slug
FROM athletes a
LEFT JOIN households h ON h.id = a.household_id
WHERE a.club_id IS DISTINCT FROM h.club_id
  OR a.club_id IS NULL;

-- Step 2: Update athletes club_id from their household
UPDATE athletes a
SET club_id = h.club_id
FROM households h
WHERE h.id = a.household_id
  AND a.club_id IS DISTINCT FROM h.club_id;

-- Step 3: For athletes without household_id, try via family_id (legacy)
UPDATE athletes a
SET club_id = p.club_id
FROM families f
JOIN profiles p ON p.id = f.profile_id
WHERE f.id = a.family_id
  AND a.household_id IS NULL
  AND (a.club_id IS NULL OR a.club_id IS DISTINCT FROM p.club_id);

-- Step 4: Verify the fix
SELECT 
  'After Update - Verification' as status,
  c.name as club_name,
  COUNT(a.id) as athlete_count,
  array_agg(a.first_name || ' ' || a.last_name ORDER BY a.first_name) as athletes
FROM clubs c
LEFT JOIN athletes a ON a.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

