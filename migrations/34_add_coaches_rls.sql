-- Migration 34: Add RLS policies for coaches table
-- Allows coaches to view their own record, admins to manage all coaches in their club

-- Step 1: Enable RLS if not already enabled
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Coaches can view their own record" ON coaches;
DROP POLICY IF EXISTS "Coaches can update their own record" ON coaches;
DROP POLICY IF EXISTS "Admins can view all coaches in their club" ON coaches;
DROP POLICY IF EXISTS "Admins can insert coaches in their club" ON coaches;
DROP POLICY IF EXISTS "Admins can update coaches in their club" ON coaches;
DROP POLICY IF EXISTS "Admins can delete coaches in their club" ON coaches;

-- Step 3: Policy to allow coaches to view their own record
CREATE POLICY "Coaches can view their own record"
ON coaches
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Step 4: Policy to allow coaches to update their own record
CREATE POLICY "Coaches can update their own record"
ON coaches
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Step 5: Policy to allow admins to view all coaches in their club
CREATE POLICY "Admins can view all coaches in their club"
ON coaches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = coaches.club_id
  )
);

-- Step 6: Policy to allow admins to insert coaches in their club
CREATE POLICY "Admins can insert coaches in their club"
ON coaches
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = coaches.club_id
  )
);

-- Step 7: Policy to allow admins to update coaches in their club
CREATE POLICY "Admins can update coaches in their club"
ON coaches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = coaches.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = coaches.club_id
  )
);

-- Step 8: Policy to allow admins to delete coaches in their club
CREATE POLICY "Admins can delete coaches in their club"
ON coaches
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = coaches.club_id
  )
);

-- Verify policies
SELECT 
  'Coaches RLS policies created' as status,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'coaches'
ORDER BY policyname;

