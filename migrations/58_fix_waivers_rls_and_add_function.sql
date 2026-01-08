-- Migration 58: Fix waivers RLS with SECURITY DEFINER function
-- Root Cause: RLS policy lookup might be failing due to profile/club_id mismatch
-- Solution: Create SECURITY DEFINER function for waiver creation (like we did for athletes)

-- Step 1: Create SECURITY DEFINER function for waiver creation
CREATE OR REPLACE FUNCTION create_waiver_for_admin(
  p_user_id UUID,
  p_club_id UUID,
  p_season_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_required BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  waiver_id UUID;
  user_profile RECORD;
BEGIN
  -- Verify the user is an admin for this club
  SELECT id, club_id, role INTO user_profile
  FROM profiles
  WHERE id = p_user_id AND club_id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found or does not belong to club';
  END IF;

  IF user_profile.role NOT IN ('admin', 'system_admin') THEN
    RAISE EXCEPTION 'User does not have admin role for this club';
  END IF;

  -- Create the waiver
  INSERT INTO waivers (
    club_id,
    season_id,
    title,
    body,
    required,
    created_by
  ) VALUES (
    p_club_id,
    p_season_id,
    p_title,
    p_body,
    p_required,
    p_user_id
  )
  RETURNING id INTO waiver_id;

  RETURN waiver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_waiver_for_admin(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Step 3: Also create an update function
CREATE OR REPLACE FUNCTION update_waiver_for_admin(
  p_user_id UUID,
  p_waiver_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_required BOOLEAN
)
RETURNS UUID AS $$
DECLARE
  user_profile RECORD;
  waiver_club_id UUID;
BEGIN
  -- Get the waiver's club_id
  SELECT club_id INTO waiver_club_id
  FROM waivers
  WHERE id = p_waiver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waiver not found';
  END IF;

  -- Verify the user is an admin for this club
  SELECT id, club_id, role INTO user_profile
  FROM profiles
  WHERE id = p_user_id AND club_id = waiver_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found or does not belong to club';
  END IF;

  IF user_profile.role NOT IN ('admin', 'system_admin') THEN
    RAISE EXCEPTION 'User does not have admin role for this club';
  END IF;

  -- Update the waiver
  UPDATE waivers
  SET
    title = p_title,
    body = p_body,
    required = p_required,
    updated_at = NOW()
  WHERE id = p_waiver_id;

  RETURN p_waiver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant execute permission
GRANT EXECUTE ON FUNCTION update_waiver_for_admin(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Step 5: Test the function exists
SELECT
  'Waiver functions created' as status,
  proname as function_name,
  prokind as function_type
FROM pg_proc
WHERE proname IN ('create_waiver_for_admin', 'update_waiver_for_admin')
ORDER BY proname;

