-- Atomically promotes the oldest waitlisted registrations for a sub_program+season
-- up to the number of available spots. Returns promoted registration details.
-- Uses FOR UPDATE SKIP LOCKED to prevent double-promotion under concurrent requests.
CREATE OR REPLACE FUNCTION promote_from_waitlist(
  p_sub_program_id UUID,
  p_season_id UUID
)
RETURNS TABLE(
  registration_id UUID,
  athlete_id UUID,
  household_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_enrolled INTEGER;
  v_available INTEGER;
BEGIN
  SELECT max_capacity INTO v_capacity
  FROM sub_programs
  WHERE id = p_sub_program_id;

  IF v_capacity IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_enrolled
  FROM registrations
  WHERE sub_program_id = p_sub_program_id
    AND season_id = p_season_id
    AND status IN ('confirmed', 'pending');

  v_available := v_capacity - v_enrolled;

  IF v_available <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH to_promote AS (
    SELECT r.id AS reg_id
    FROM registrations r
    WHERE r.sub_program_id = p_sub_program_id
      AND r.season_id = p_season_id
      AND r.status = 'waitlisted'
    ORDER BY r.created_at ASC
    LIMIT v_available
    FOR UPDATE SKIP LOCKED
  ),
  promoted AS (
    UPDATE registrations reg
    SET status = 'pending',
        updated_at = NOW()
    WHERE reg.id IN (SELECT reg_id FROM to_promote)
    RETURNING reg.id AS reg_id, reg.athlete_id AS reg_athlete_id
  )
  SELECT
    p.reg_id         AS registration_id,
    p.reg_athlete_id AS athlete_id,
    a.household_id
  FROM promoted p
  JOIN athletes a ON a.id = p.reg_athlete_id;
END;
$$;

GRANT EXECUTE ON FUNCTION promote_from_waitlist(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_from_waitlist(UUID, UUID) TO service_role;


-- Trigger: auto-promote from waitlist whenever a confirmed or pending registration
-- is cancelled, freeing up a spot. No manual intervention needed.
CREATE OR REPLACE FUNCTION trigger_promote_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'pending') THEN
    PERFORM promote_from_waitlist(NEW.sub_program_id, NEW.season_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_promote_waitlist ON registrations;
CREATE TRIGGER auto_promote_waitlist
  AFTER UPDATE OF status ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_promote_on_cancellation();
