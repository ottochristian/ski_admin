-- Migration 56: Add SECURITY DEFINER function for athlete creation
-- Root Cause: RLS policies prevent parents from creating athletes due to household_guardians INSERT restrictions
-- Solution: Create a SECURITY DEFINER function that handles the entire athlete creation process

-- Step 1: Create function to create athlete with proper household linking
-- NOTE: Optional parameters with defaults must come after required parameters
CREATE OR REPLACE FUNCTION create_athlete_for_parent(
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_household_id UUID,
  p_club_id UUID,
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  athlete_id UUID;
  guardian_exists BOOLEAN;
BEGIN
  -- Check if the user is actually linked to this household
  SELECT EXISTS(
    SELECT 1 FROM household_guardians
    WHERE user_id = p_user_id AND household_id = p_household_id
  ) INTO guardian_exists;

  -- If not linked, create the household_guardians record
  IF NOT guardian_exists THEN
    INSERT INTO household_guardians (household_id, user_id, is_primary, club_id)
    SELECT p_household_id, p_user_id, true, p_club_id
    WHERE EXISTS (
      SELECT 1 FROM households h
      WHERE h.id = p_household_id AND h.club_id = p_club_id
    );
  END IF;

  -- Create the athlete
  INSERT INTO athletes (
    first_name,
    last_name,
    household_id,
    club_id,
    date_of_birth,
    gender
  ) VALUES (
    p_first_name,
    p_last_name,
    p_household_id,
    p_club_id,
    p_date_of_birth,
    p_gender
  )
  RETURNING id INTO athlete_id;

  RETURN athlete_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_athlete_for_parent(UUID, TEXT, TEXT, UUID, UUID, DATE, TEXT) TO authenticated;

-- Step 3: Test the function
SELECT
  'Athlete creation function created' as status,
  proname as function_name,
  prokind as function_type,
  provolatile as volatility
FROM pg_proc
WHERE proname = 'create_athlete_for_parent';
