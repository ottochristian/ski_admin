-- Migration 65: Fix RLS policy for household_guardians to allow all guardians in same household to see each other
-- Current policy only allows users to see their own record, preventing secondary guardians from seeing primary
-- FIX: Use SECURITY DEFINER function to avoid infinite recursion in RLS policy

-- Step 1: Drop the existing restrictive policy
DROP POLICY IF EXISTS "Parents can view their household_guardians link" ON household_guardians;

-- Step 2: Drop the new policy if it already exists (for idempotency)
DROP POLICY IF EXISTS "Guardians can view all guardians in their household" ON household_guardians;

-- Step 3: Create SECURITY DEFINER function to check if user is guardian in a household
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_user_guardian_in_household(
  p_user_id UUID,
  p_household_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = p_household_id
      AND hg.user_id = p_user_id
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_guardian_in_household(UUID, UUID) TO authenticated;

-- Step 4: Create new policy that allows all guardians in the same household to see each other
-- Uses SECURITY DEFINER function to avoid infinite recursion
CREATE POLICY "Guardians can view all guardians in their household"
ON household_guardians
FOR SELECT
TO authenticated
USING (
  -- User can always see their own record
  user_id = auth.uid()
  OR
  -- User can see all guardians in households where they are a guardian (using function to avoid recursion)
  public.is_user_guardian_in_household(auth.uid(), household_id)
);

-- Step 4: Verify the policy was created
SELECT 
  'Guardian visibility policy updated' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'household_guardians'
  AND policyname = 'Guardians can view all guardians in their household';

