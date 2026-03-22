-- SECURITY DEFINER function to get accurate enrollment counts bypassing RLS.
-- Parents can only see their own registrations via RLS, so we need this function
-- to show true capacity numbers on the programs page.
CREATE OR REPLACE FUNCTION get_season_enrollment_counts(p_season_id UUID)
RETURNS TABLE(sub_program_id UUID, enrolled INTEGER, waitlisted INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT sub_program_id,
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'pending'))::INTEGER AS enrolled,
    COUNT(*) FILTER (WHERE status = 'waitlisted')::INTEGER AS waitlisted
  FROM registrations WHERE season_id = p_season_id
  GROUP BY sub_program_id
$func$;

GRANT EXECUTE ON FUNCTION get_season_enrollment_counts(UUID) TO authenticated;
