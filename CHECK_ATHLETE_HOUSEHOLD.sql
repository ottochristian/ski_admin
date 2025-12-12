-- Diagnostic query to check athlete household links
-- Run this in Supabase SQL Editor to see what's wrong

-- Replace with your email
\set email 'ottilieotto+1@gmail.com'

-- 1. Check your profile and household guardian link
SELECT 
  '1. Your Profile & Household Link' as check_step,
  p.id as user_id,
  p.email,
  hg.household_id as your_household_id,
  CASE WHEN hg.household_id IS NULL THEN '❌ MISSING household_guardians link' ELSE '✅ OK' END as household_link_status
FROM profiles p
LEFT JOIN household_guardians hg ON hg.user_id = p.id
WHERE p.email = :'email';

-- 2. Check athletes and their household links
SELECT 
  '2. Athletes in Your Cart' as check_step,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.household_id as athlete_household_id,
  a.family_id as athlete_family_id,
  CASE 
    WHEN a.household_id IS NULL AND a.family_id IS NULL THEN '❌ NO household or family link'
    WHEN a.household_id IS NOT NULL THEN '✅ Has household_id'
    WHEN a.family_id IS NOT NULL THEN '✅ Has family_id'
  END as athlete_link_status
FROM athletes a
WHERE a.id IN (
  -- Replace these with the actual athlete IDs from your error (you'll see them in browser console)
  '4232fbac-4492-4f6e-93fb-b31155936d64'
  -- Add more athlete IDs here if you have multiple
);

-- 3. Check if your household_id matches the athletes' household_id
WITH user_household AS (
  SELECT hg.household_id
  FROM profiles p
  JOIN household_guardians hg ON hg.user_id = p.id
  WHERE p.email = :'email'
)
SELECT 
  '3. Household Match Check' as check_step,
  a.id as athlete_id,
  a.first_name || ' ' || a.last_name as athlete_name,
  a.household_id as athlete_household_id,
  uh.household_id as your_household_id,
  CASE 
    WHEN a.household_id = uh.household_id THEN '✅ MATCH - Should work!'
    WHEN a.household_id IS NULL THEN '❌ Athlete has no household_id'
    WHEN uh.household_id IS NULL THEN '❌ You have no household_id'
    ELSE '❌ MISMATCH - Household IDs do not match'
  END as match_status
FROM athletes a
CROSS JOIN user_household uh
WHERE a.id IN (
  '4232fbac-4492-4f6e-93fb-b31155936d64'
  -- Add more athlete IDs here
);

-- 4. Quick fix: Link athletes to your household
-- UNCOMMENT AND RUN THIS ONLY AFTER VERIFYING THE DIAGNOSTIC QUERIES ABOVE
/*
WITH user_household AS (
  SELECT hg.household_id
  FROM profiles p
  JOIN household_guardians hg ON hg.user_id = p.id
  WHERE p.email = :'email'
  LIMIT 1
)
UPDATE athletes a
SET household_id = uh.household_id
FROM user_household uh
WHERE a.id IN (
  '4232fbac-4492-4f6e-93fb-b31155936d64'
  -- Add more athlete IDs here
)
AND a.household_id IS NULL;
*/
