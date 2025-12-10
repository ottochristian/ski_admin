-- Migration 39: Add RLS policies for programs table
-- Allows admins to manage programs in their club
-- Coaches can view programs they're assigned to (via coach_assignments)
-- Parents can view programs (for registration)

-- Step 1: Enable RLS if not already enabled
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Admins can view all programs in their club" ON programs;
DROP POLICY IF EXISTS "Admins can insert programs in their club" ON programs;
DROP POLICY IF EXISTS "Admins can update programs in their club" ON programs;
DROP POLICY IF EXISTS "Admins can delete programs in their club" ON programs;
DROP POLICY IF EXISTS "Coaches can view programs they're assigned to" ON programs;
DROP POLICY IF EXISTS "Parents can view programs in their club" ON programs;

-- Step 3: Policy to allow admins to view all programs in their club
CREATE POLICY "Admins can view all programs in their club"
ON programs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = programs.club_id
  )
);

-- Step 4: Policy to allow admins to insert programs in their club
CREATE POLICY "Admins can insert programs in their club"
ON programs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = programs.club_id
  )
);

-- Step 5: Policy to allow admins to update programs in their club
CREATE POLICY "Admins can update programs in their club"
ON programs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = programs.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = programs.club_id
  )
);

-- Step 6: Policy to allow admins to delete programs in their club
CREATE POLICY "Admins can delete programs in their club"
ON programs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = programs.club_id
  )
);

-- Step 7: Policy to allow coaches to view programs they're assigned to
CREATE POLICY "Coaches can view programs they're assigned to"
ON programs
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
      AND ca.program_id = programs.id
      AND ca.group_id IS NULL
      AND ca.sub_program_id IS NULL
  )
);

-- Step 8: Policy to allow parents to view programs in their club
CREATE POLICY "Parents can view programs in their club"
ON programs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.club_id = programs.club_id
  )
);

-- Verify policies were created
SELECT 
  'Programs RLS policies created' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'programs'
ORDER BY policyname;
