-- Migration 57: Fix waivers RLS policies
-- Root Cause: INSERT operations need WITH CHECK clause, not just USING
-- The "Club admins can manage waivers" policy only had USING, which doesn't apply to INSERT

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "Club admins can manage waivers" ON waivers;

-- Step 2: Create separate policies for different operations
-- Admins can SELECT waivers for their club
CREATE POLICY "Club admins can view waivers for their club" ON waivers
  FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- Admins can INSERT waivers for their club
CREATE POLICY "Club admins can insert waivers for their club" ON waivers
  FOR INSERT
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- Admins can UPDATE waivers for their club
CREATE POLICY "Club admins can update waivers for their club" ON waivers
  FOR UPDATE
  USING (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- Admins can DELETE waivers for their club
CREATE POLICY "Club admins can delete waivers for their club" ON waivers
  FOR DELETE
  USING (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- Step 3: Verify policies were created
SELECT
  'Waivers RLS Policies Fixed' as status,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'waivers'
ORDER BY policyname;

