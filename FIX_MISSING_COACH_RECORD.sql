-- Fix missing coach record for ottilieotto+alpine+testcoach@gmail.com
-- This creates the coaches table entry that's missing for this profile

-- Step 1: Verify the profile exists
SELECT 
  id as profile_id,
  email,
  role,
  club_id,
  first_name,
  last_name
FROM profiles
WHERE email = 'ottilieotto+alpine+testcoach@gmail.com'
  AND role = 'coach';

-- Step 2: Check if a coach record exists with this email but different profile_id
SELECT 
  c.id as coach_id,
  c.profile_id as existing_profile_id,
  c.email,
  p.id as correct_profile_id
FROM coaches c
CROSS JOIN profiles p
WHERE c.email = 'ottilieotto+alpine+testcoach@gmail.com'
  AND p.email = 'ottilieotto+alpine+testcoach@gmail.com'
  AND p.role = 'coach';

-- Step 3: Update existing coach record to link to correct profile, or create new one
-- First, try to update if a coach record exists with this email
UPDATE coaches
SET 
  profile_id = (
    SELECT id FROM profiles 
    WHERE email = 'ottilieotto+alpine+testcoach@gmail.com' 
      AND role = 'coach'
    LIMIT 1
  ),
  club_id = COALESCE(
    coaches.club_id,
    (SELECT club_id FROM profiles WHERE email = 'ottilieotto+alpine+testcoach@gmail.com' AND role = 'coach' LIMIT 1)
  ),
  first_name = COALESCE(
    coaches.first_name,
    (SELECT first_name FROM profiles WHERE email = 'ottilieotto+alpine+testcoach@gmail.com' AND role = 'coach' LIMIT 1)
  ),
  last_name = COALESCE(
    coaches.last_name,
    (SELECT last_name FROM profiles WHERE email = 'ottilieotto+alpine+testcoach@gmail.com' AND role = 'coach' LIMIT 1)
  )
WHERE email = 'ottilieotto+alpine+testcoach@gmail.com'
  AND (
    profile_id IS NULL 
    OR profile_id != (SELECT id FROM profiles WHERE email = 'ottilieotto+alpine+testcoach@gmail.com' AND role = 'coach' LIMIT 1)
  );

-- Step 4: If no coach record exists with this email, create one
INSERT INTO coaches (profile_id, club_id, first_name, last_name, email)
SELECT 
  id as profile_id,
  club_id,
  first_name,
  last_name,
  email
FROM profiles
WHERE email = 'ottilieotto+alpine+testcoach@gmail.com'
  AND role = 'coach'
  AND NOT EXISTS (
    SELECT 1 FROM coaches 
    WHERE email = 'ottilieotto+alpine+testcoach@gmail.com'
  )
ON CONFLICT (email) DO UPDATE
SET 
  profile_id = EXCLUDED.profile_id,
  club_id = COALESCE(coaches.club_id, EXCLUDED.club_id),
  first_name = COALESCE(coaches.first_name, EXCLUDED.first_name),
  last_name = COALESCE(coaches.last_name, EXCLUDED.last_name)
RETURNING *;

-- Step 5: Verify the coach record was created/updated correctly
SELECT 
  c.*,
  p.email as profile_email,
  p.role as profile_role
FROM coaches c
JOIN profiles p ON p.id = c.profile_id
WHERE p.email = 'ottilieotto+alpine+testcoach@gmail.com';
