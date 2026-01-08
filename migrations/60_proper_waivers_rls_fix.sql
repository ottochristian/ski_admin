-- Migration 60: Proper RLS fix for waivers (not a workaround)
-- Root Cause: RLS policy subquery might fail if profile lookup is complex
-- Solution: Simplify policy to directly check profile in same query context

-- Step 1: Drop all existing waiver policies
DROP POLICY IF EXISTS "Club admins can manage waivers" ON waivers;
DROP POLICY IF EXISTS "Club admins can view waivers for their club" ON waivers;
DROP POLICY IF EXISTS "Club admins can insert waivers for their club" ON waivers;
DROP POLICY IF EXISTS "Club admins can update waivers for their club" ON waivers;
DROP POLICY IF EXISTS "Club admins can delete waivers for their club" ON waivers;
DROP POLICY IF EXISTS "Parents can view waivers" ON waivers;

-- Step 2: Create a helper function to check if user is admin for a club
-- This is NOT SECURITY DEFINER - it's just a helper for RLS policies
CREATE OR REPLACE FUNCTION is_admin_for_club(p_club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('admin', 'system_admin')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- Step 3: Create proper RLS policies using the helper function
-- Admins can SELECT waivers for their club
CREATE POLICY "Club admins can view waivers for their club" ON waivers
  FOR SELECT
  USING (is_admin_for_club(club_id));

-- Admins can INSERT waivers for their club
CREATE POLICY "Club admins can insert waivers for their club" ON waivers
  FOR INSERT
  WITH CHECK (is_admin_for_club(club_id));

-- Admins can UPDATE waivers for their club
CREATE POLICY "Club admins can update waivers for their club" ON waivers
  FOR UPDATE
  USING (is_admin_for_club(club_id))
  WITH CHECK (is_admin_for_club(club_id));

-- Admins can DELETE waivers for their club
CREATE POLICY "Club admins can delete waivers for their club" ON waivers
  FOR DELETE
  USING (is_admin_for_club(club_id));

-- Parents can view active waivers for their club
CREATE POLICY "Parents can view waivers" ON waivers
  FOR SELECT
  USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND club_id = waivers.club_id
    )
  );

-- Step 4: Grant execute on helper function to authenticated users
GRANT EXECUTE ON FUNCTION is_admin_for_club(UUID) TO authenticated;

-- Step 5: Verify policies
SELECT
  'Proper RLS Policies Created' as status,
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN 'Has WITH CHECK ✓' ELSE 'Missing WITH CHECK ✗' END as with_check_status
FROM pg_policies
WHERE tablename = 'waivers'
ORDER BY policyname;

