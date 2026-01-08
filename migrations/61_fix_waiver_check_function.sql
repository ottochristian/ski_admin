-- Migration 61: Fix has_signed_required_waivers function to filter by club and season
-- Issue: Function was checking all waivers, not filtering by athlete's club or season
-- Solution: Update function to filter by athlete's club_id and accept optional season_id parameter

-- Step 1: Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.has_signed_required_waivers(UUID);
DROP FUNCTION IF EXISTS public.has_signed_required_waivers(UUID, UUID);

-- Step 2: Create the function with 2 parameters (explicit version)
CREATE FUNCTION has_signed_required_waivers(
  p_athlete_id UUID,
  p_season_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_athlete_club_id UUID;
BEGIN
  -- Get athlete's club_id
  SELECT club_id INTO v_athlete_club_id
  FROM athletes
  WHERE id = p_athlete_id;

  IF v_athlete_club_id IS NULL THEN
    RETURN false; -- No athlete found
  END IF;

  -- Check if athlete has signed ALL required waivers for their club and season
  RETURN NOT EXISTS (
    SELECT 1
    FROM waivers w
    LEFT JOIN waiver_signatures ws 
      ON ws.waiver_id = w.id 
      AND ws.athlete_id = p_athlete_id
    WHERE w.club_id = v_athlete_club_id
      AND w.season_id = p_season_id
      AND w.required = true
      AND w.status = 'active'
      AND ws.id IS NULL -- No signature found for this required waiver
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Step 3: Create the 1-parameter version that uses current season
CREATE FUNCTION has_signed_required_waivers(
  p_athlete_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_athlete_club_id UUID;
  v_current_season_id UUID;
BEGIN
  -- Get athlete's club_id
  SELECT club_id INTO v_athlete_club_id
  FROM athletes
  WHERE id = p_athlete_id;

  IF v_athlete_club_id IS NULL THEN
    RETURN false; -- No athlete found
  END IF;

  -- Get current season
  SELECT id INTO v_current_season_id
  FROM seasons
  WHERE is_current = true
  LIMIT 1;

  IF v_current_season_id IS NULL THEN
    RETURN false; -- No current season found
  END IF;

  -- Check if athlete has signed ALL required waivers for their club and current season
  RETURN NOT EXISTS (
    SELECT 1
    FROM waivers w
    LEFT JOIN waiver_signatures ws 
      ON ws.waiver_id = w.id 
      AND ws.athlete_id = p_athlete_id
    WHERE w.club_id = v_athlete_club_id
      AND w.season_id = v_current_season_id
      AND w.required = true
      AND w.status = 'active'
      AND ws.id IS NULL -- No signature found for this required waiver
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Step 4: Grant execute permissions on both function signatures
GRANT EXECUTE ON FUNCTION has_signed_required_waivers(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_signed_required_waivers(UUID) TO authenticated;

-- Step 5: Verification query
SELECT
  'has_signed_required_waivers function updated' as status,
  proname,
  pronargs,
  pg_get_function_identity_arguments(oid) as signature
FROM pg_proc
WHERE proname = 'has_signed_required_waivers'
ORDER BY pronargs;
