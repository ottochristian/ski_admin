-- Fix athlete club_id to match the club they're being registered for
-- Run this in Supabase SQL Editor

-- Replace with your email and the correct club_id
\set email 'ottilieotto+1@gmail.com'
\set correct_club_id '9a372457-0bae-42a7-8af8-0bbbe8bd42a6'
\set athlete_id '4232fbac-4492-4f6e-93fb-b31155936d64'

-- 1. Check current state
SELECT 
  'Current State' as check_step,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.club_id as current_club_id,
  c1.name as current_club_name,
  :'correct_club_id' as target_club_id,
  c2.name as target_club_name
FROM athletes a
LEFT JOIN clubs c1 ON c1.id = a.club_id
LEFT JOIN clubs c2 ON c2.id = :'correct_club_id'
WHERE a.id = :'athlete_id';

-- 2. Verify household link
SELECT 
  'Household Verification' as check_step,
  p.email,
  hg.household_id,
  a.id as athlete_id,
  a.household_id as athlete_household_id,
  CASE 
    WHEN a.household_id = hg.household_id THEN '✅ Household matches'
    ELSE '❌ Household mismatch'
  END as household_status
FROM profiles p
JOIN household_guardians hg ON hg.user_id = p.id
JOIN athletes a ON a.household_id = hg.household_id
WHERE p.email = :'email'
  AND a.id = :'athlete_id';

-- 3. UPDATE the athlete's club_id (UNCOMMENT TO RUN)
/*
UPDATE athletes
SET club_id = :'correct_club_id'
WHERE id = :'athlete_id'
  AND household_id IN (
    SELECT hg.household_id
    FROM profiles p
    JOIN household_guardians hg ON hg.user_id = p.id
    WHERE p.email = :'email'
  );

-- Verify the update
SELECT 
  'After Update' as check_step,
  a.id as athlete_id,
  a.club_id,
  c.name as club_name,
  CASE 
    WHEN a.club_id = :'correct_club_id' THEN '✅ Fixed'
    ELSE '❌ Still wrong'
  END as status
FROM athletes a
LEFT JOIN clubs c ON c.id = a.club_id
WHERE a.id = :'athlete_id';
*/

