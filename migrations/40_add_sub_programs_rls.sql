-- Migration 40: Add RLS policies for sub_programs table
-- Allows admins to manage sub_programs in their club
-- Coaches can view sub_programs they're assigned to
-- Parents can view sub_programs (for registration)

-- Step 1: Enable RLS if not already enabled
ALTER TABLE sub_programs ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Admins can view all sub_programs in their club" ON sub_programs;
DROP POLICY IF EXISTS "Admins can insert sub_programs in their club" ON sub_programs;
DROP POLICY IF EXISTS "Admins can update sub_programs in their club" ON sub_programs;
DROP POLICY IF EXISTS "Admins can delete sub_programs in their club" ON sub_programs;
DROP POLICY IF EXISTS "Coaches can view sub_programs they're assigned to" ON sub_programs;
DROP POLICY IF EXISTS "Parents can view sub_programs in their club" ON sub_programs;

-- Step 3: Policy to allow admins to view all sub_programs in their club
-- OPTIMIZED: Use sub_programs.club_id directly (more efficient than joining through programs)
CREATE POLICY "Admins can view all sub_programs in their club"
ON sub_programs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = sub_programs.club_id
  )
);

-- Step 4: Policy to allow admins to insert sub_programs in their club
-- OPTIMIZED: Use sub_programs.club_id directly
CREATE POLICY "Admins can insert sub_programs in their club"
ON sub_programs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = sub_programs.club_id
  )
);

-- Step 5: Policy to allow admins to update sub_programs in their club
-- OPTIMIZED: Use sub_programs.club_id directly
CREATE POLICY "Admins can update sub_programs in their club"
ON sub_programs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = sub_programs.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = sub_programs.club_id
  )
);

-- Step 6: Policy to allow admins to delete sub_programs in their club
-- OPTIMIZED: Use sub_programs.club_id directly
CREATE POLICY "Admins can delete sub_programs in their club"
ON sub_programs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = sub_programs.club_id
  )
);

-- Step 7: Policy to allow coaches to view sub_programs they're assigned to
CREATE POLICY "Coaches can view sub_programs they're assigned to"
ON sub_programs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN coaches c ON c.profile_id = p.id
    INNER JOIN coach_assignments ca ON ca.coach_id = c.id
    WHERE p.id = auth.uid()
      AND p.role = 'coach'
      AND ca.sub_program_id = sub_programs.id
  )
);

-- Step 8: Policy to allow parents to view sub_programs in their club
-- OPTIMIZED: Use sub_programs.club_id directly
CREATE POLICY "Parents can view sub_programs in their club"
ON sub_programs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.club_id = sub_programs.club_id
  )
);

-- Verify policies were created
SELECT 
  'Sub-programs RLS policies created' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'sub_programs'
ORDER BY policyname;


