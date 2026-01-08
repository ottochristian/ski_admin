-- Migration 62: Fix athletes UPDATE RLS policy
-- The issue: UPDATE queries are returning no rows even though SELECT works
-- This suggests the WITH CHECK clause might be failing

-- Step 1: Drop the existing update policy
DROP POLICY IF EXISTS "Parents can update athletes in their household" ON athletes;

-- Step 2: Recreate with explicit checks
-- The key is ensuring both USING (for reading) and WITH CHECK (for writing) pass
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.user_id = auth.uid()
      AND hg.household_id = athletes.household_id
  )
);

-- Step 3: Verify the policy was created
SELECT 
  'Athletes UPDATE RLS policy recreated' as status,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'athletes' 
  AND policyname = 'Parents can update athletes in their household';

