-- Migration 55: Fix household_guardians RLS policies
-- Root Cause: Parents need to INSERT household_guardians records to link themselves to households
-- But the RLS policies only allow SELECT operations

-- Step 1: Add INSERT policy for parents to create household_guardians links
CREATE POLICY "Parents can insert household_guardians for themselves"
ON household_guardians
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Step 2: Add UPDATE policy for parents to modify their own links (if needed)
CREATE POLICY "Parents can update their household_guardians link"
ON household_guardians
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 3: Add INSERT policy for admins to create household_guardians links
CREATE POLICY "Admins can insert household_guardians in their club"
ON household_guardians
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = household_guardians.club_id
  )
);

-- Step 4: Add UPDATE policy for admins
CREATE POLICY "Admins can update household_guardians in their club"
ON household_guardians
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = household_guardians.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = household_guardians.club_id
  )
);

-- Step 5: Verify all policies exist
SELECT
  'Household Guardians RLS Policies' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'household_guardians'
ORDER BY policyname;
