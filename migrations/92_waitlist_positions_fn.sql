-- SECURITY DEFINER function to return per-registration queue positions for all
-- waitlisted entries in a season. Used on the parent dashboard to show position.
CREATE OR REPLACE FUNCTION get_waitlist_positions(p_season_id UUID)
RETURNS TABLE(registration_id UUID, sub_program_id UUID, queue_position INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT id, sub_program_id,
    ROW_NUMBER() OVER (PARTITION BY sub_program_id ORDER BY created_at ASC)::INTEGER
  FROM registrations WHERE season_id = p_season_id AND status = 'waitlisted'
$func$;

GRANT EXECUTE ON FUNCTION get_waitlist_positions(UUID) TO authenticated;
