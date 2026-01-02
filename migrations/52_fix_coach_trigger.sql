-- Migration 52: Fix coach record trigger
-- The trigger should automatically create coach records when a profile with role='coach' is created
-- This migration fixes the function to be more robust and adds proper search_path

-- Step 0: Ensure the unique constraint exists on coaches.profile_id
DO $$
BEGIN
  -- Check if unique constraint exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'coaches_profile_id_unique'
      AND table_name = 'coaches'
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE coaches ADD CONSTRAINT coaches_profile_id_unique UNIQUE (profile_id);
  END IF;
END $$;

-- Step 1: Drop and recreate the function with proper settings
CREATE OR REPLACE FUNCTION ensure_coach_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if role is 'coach'
  IF NEW.role = 'coach' THEN
    -- Try to insert or update coach record
    -- Use INSERT...ON CONFLICT to handle both new and existing records
    INSERT INTO public.coaches (profile_id, club_id, first_name, last_name, email)
    VALUES (NEW.id, NEW.club_id, NEW.first_name, NEW.last_name, NEW.email)
    ON CONFLICT (profile_id) DO UPDATE
    SET
      club_id = EXCLUDED.club_id,
      first_name = COALESCE(public.coaches.first_name, EXCLUDED.first_name),
      last_name = COALESCE(public.coaches.last_name, EXCLUDED.last_name),
      email = COALESCE(public.coaches.email, EXCLUDED.email);
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the profile insert
    RAISE WARNING 'Failed to create/update coach record for profile %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Step 2: Verify the triggers still exist and are active
SELECT 
  'Coach record triggers' as status,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name LIKE '%coach%'
ORDER BY trigger_name;

-- Step 3: Test the trigger by checking if coach records exist for coach profiles
-- This will show any profiles with role='coach' that don't have a coach record
SELECT 
  'Profiles missing coach records' as status,
  p.id as profile_id,
  p.email,
  p.first_name,
  p.last_name,
  p.club_id
FROM profiles p
LEFT JOIN coaches c ON c.profile_id = p.id
WHERE p.role = 'coach'
  AND c.id IS NULL;

-- Step 4: Fix any existing profiles that are missing coach records
-- This will backfill any coaches that were created before the trigger was fixed
INSERT INTO coaches (profile_id, club_id, first_name, last_name, email)
SELECT 
  p.id,
  p.club_id,
  p.first_name,
  p.last_name,
  p.email
FROM profiles p
LEFT JOIN coaches c ON c.profile_id = p.id
WHERE p.role = 'coach'
  AND c.id IS NULL
ON CONFLICT (profile_id) DO NOTHING;

-- Step 5: Verify all coach profiles now have coach records
SELECT 
  'Verification: Coach profiles without coach records (should be 0)' as status,
  COUNT(*) as missing_count
FROM profiles p
LEFT JOIN coaches c ON c.profile_id = p.id
WHERE p.role = 'coach'
  AND c.id IS NULL;
