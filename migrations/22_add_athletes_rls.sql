-- Migration 22: Add RLS policies for athletes table
-- Allows parents to manage athletes in their household, admins to manage all athletes in their club

-- Step 1: Enable RLS if not already enabled
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Parents can view athletes in their household" ON athletes;
DROP POLICY IF EXISTS "Parents can insert athletes into their household" ON athletes;
DROP POLICY IF EXISTS "Parents can update athletes in their household" ON athletes;
DROP POLICY IF EXISTS "Admins can view all athletes in their club" ON athletes;
DROP POLICY IF EXISTS "Admins can insert athletes in their club" ON athletes;
DROP POLICY IF EXISTS "Admins can update athletes in their club" ON athletes;

-- Step 3: Policy to allow parents to view athletes in their household
-- Check via household_guardians join table
CREATE POLICY "Parents can view athletes in their household"
ON athletes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = athletes.household_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
);

-- Step 4: Policy to allow parents to insert athletes into their household
CREATE POLICY "Parents can insert athletes into their household"
ON athletes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = athletes.household_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
);

-- Step 5: Policy to allow parents to update athletes in their household
CREATE POLICY "Parents can update athletes in their household"
ON athletes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = athletes.household_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = athletes.household_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
);

-- Step 6: Policy to allow admins to view all athletes in their club
CREATE POLICY "Admins can view all athletes in their club"
ON athletes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Step 7: Policy to allow admins to insert athletes in their club
CREATE POLICY "Admins can insert athletes in their club"
ON athletes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Step 8: Policy to allow admins to update athletes in their club
CREATE POLICY "Admins can update athletes in their club"
ON athletes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = athletes.club_id
  )
);

-- Verify policies
SELECT 
  'Athletes RLS policies created' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'athletes'
ORDER BY policyname;
