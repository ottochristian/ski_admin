-- Migration 29: Add RLS policies for registrations table
-- Allows parents to create/view registrations for athletes in their household
-- Allows admins to manage all registrations in their club

-- Step 1: Enable RLS if not already enabled
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Parents can view registrations for their athletes" ON registrations;
DROP POLICY IF EXISTS "Parents can insert registrations for their athletes" ON registrations;
DROP POLICY IF EXISTS "Parents can update registrations for their athletes" ON registrations;
DROP POLICY IF EXISTS "Admins can view all registrations in their club" ON registrations;
DROP POLICY IF EXISTS "Admins can insert registrations in their club" ON registrations;
DROP POLICY IF EXISTS "Admins can update registrations in their club" ON registrations;
DROP POLICY IF EXISTS "Admins can delete registrations in their club" ON registrations;

-- Step 3: Policy to allow parents to view registrations for athletes in their household
CREATE POLICY "Parents can view registrations for their athletes"
ON registrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN household_guardians hg ON hg.household_id = a.household_id
    WHERE hg.user_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN families f ON f.id = a.family_id
    WHERE f.profile_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
);

-- Step 4: Policy to allow parents to insert registrations for athletes in their household
CREATE POLICY "Parents can insert registrations for their athletes"
ON registrations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN household_guardians hg ON hg.household_id = a.household_id
    WHERE hg.user_id = auth.uid()
      AND a.id = registrations.athlete_id
      AND a.club_id = registrations.club_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN families f ON f.id = a.family_id
    WHERE f.profile_id = auth.uid()
      AND a.id = registrations.athlete_id
      AND a.club_id = registrations.club_id
  )
);

-- Step 5: Policy to allow parents to update registrations for their athletes
CREATE POLICY "Parents can update registrations for their athletes"
ON registrations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN household_guardians hg ON hg.household_id = a.household_id
    WHERE hg.user_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN families f ON f.id = a.family_id
    WHERE f.profile_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN household_guardians hg ON hg.household_id = a.household_id
    WHERE hg.user_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
  OR
  -- Fallback: check via legacy families table
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN families f ON f.id = a.family_id
    WHERE f.profile_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
);

-- Step 6: Policy to allow admins to view all registrations in their club
CREATE POLICY "Admins can view all registrations in their club"
ON registrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = registrations.club_id
  )
);

-- Step 7: Policy to allow admins to insert registrations in their club
CREATE POLICY "Admins can insert registrations in their club"
ON registrations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = registrations.club_id
  )
);

-- Step 8: Policy to allow admins to update registrations in their club
CREATE POLICY "Admins can update registrations in their club"
ON registrations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = registrations.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = registrations.club_id
  )
);

-- Step 9: Policy to allow admins to delete registrations in their club
CREATE POLICY "Admins can delete registrations in their club"
ON registrations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = registrations.club_id
  )
);

-- Verify policies
SELECT 
  'Registrations RLS policies created' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'registrations'
ORDER BY policyname;



