-- Migration 35: Prevent coach profile_id linkage issues
-- This migration adds constraints and triggers to ensure coaches are always properly linked to profiles

-- Step 1: Ensure profile_id is NOT NULL and has foreign key constraint
-- First, fix any existing NULL profile_ids by attempting to link them via email
UPDATE coaches c
SET profile_id = p.id
FROM profiles p
WHERE c.profile_id IS NULL
  AND c.email IS NOT NULL
  AND p.email = c.email
  AND p.role = 'coach';

-- Step 2: Make profile_id NOT NULL (if there are still NULLs, they'll need manual fixing)
ALTER TABLE coaches ALTER COLUMN profile_id SET NOT NULL;

-- Step 3: Add unique constraint on profile_id (one coach per profile)
-- Drop existing constraint if it exists
ALTER TABLE coaches DROP CONSTRAINT IF EXISTS coaches_profile_id_key;
ALTER TABLE coaches DROP CONSTRAINT IF EXISTS coaches_profile_id_unique;

-- Add unique constraint
ALTER TABLE coaches ADD CONSTRAINT coaches_profile_id_unique UNIQUE (profile_id);

-- Step 4: Ensure foreign key constraint exists (should already exist, but verify)
DO $$
BEGIN
  -- Check if foreign key exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'coaches_profile_id_fkey'
      AND table_name = 'coaches'
  ) THEN
    -- Add foreign key if it doesn't exist
    ALTER TABLE coaches
    ADD CONSTRAINT coaches_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Create a function to automatically create/update coach record when profile is created/updated
CREATE OR REPLACE FUNCTION ensure_coach_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if role is 'coach'
  IF NEW.role = 'coach' THEN
    -- Try to insert or update coach record
    INSERT INTO coaches (profile_id, club_id, first_name, last_name, email)
    VALUES (NEW.id, NEW.club_id, NEW.first_name, NEW.last_name, NEW.email)
    ON CONFLICT (profile_id) DO UPDATE
    SET
      club_id = EXCLUDED.club_id,
      first_name = COALESCE(coaches.first_name, EXCLUDED.first_name),
      last_name = COALESCE(coaches.last_name, EXCLUDED.last_name),
      email = COALESCE(coaches.email, EXCLUDED.email);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger to auto-create coach record when profile with coach role is created
DROP TRIGGER IF EXISTS trigger_ensure_coach_record_on_insert ON profiles;
CREATE TRIGGER trigger_ensure_coach_record_on_insert
AFTER INSERT ON profiles
FOR EACH ROW
WHEN (NEW.role = 'coach')
EXECUTE FUNCTION ensure_coach_record();

-- Step 7: Create trigger to update coach record when profile with coach role is updated
DROP TRIGGER IF EXISTS trigger_ensure_coach_record_on_update ON profiles;
CREATE TRIGGER trigger_ensure_coach_record_on_update
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (NEW.role = 'coach' AND (
  OLD.role != 'coach' OR
  OLD.club_id IS DISTINCT FROM NEW.club_id OR
  OLD.first_name IS DISTINCT FROM NEW.first_name OR
  OLD.last_name IS DISTINCT FROM NEW.last_name OR
  OLD.email IS DISTINCT FROM NEW.email
))
EXECUTE FUNCTION ensure_coach_record();

-- Step 8: Verify constraints
SELECT 
  'Coaches table constraints' as status,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'coaches'
  AND constraint_type IN ('UNIQUE', 'FOREIGN KEY', 'NOT NULL')
ORDER BY constraint_name;

-- Step 9: Verify triggers
SELECT 
  'Coaches triggers' as status,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name LIKE '%coach%'
ORDER BY trigger_name;
