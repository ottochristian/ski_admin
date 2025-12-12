-- Migration 38: Add RLS policies for households and household_guardians tables
-- This ensures parents can read their own household data via nested queries
-- CRITICAL: This likely broke when we changed from households(*) to explicit field selection

-- Step 1: Enable RLS on households table
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Step 2: Enable RLS on household_guardians table
ALTER TABLE household_guardians ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Parents can view their household" ON households;
DROP POLICY IF EXISTS "Admins can view all households in their club" ON households;
DROP POLICY IF EXISTS "Parents can update their household" ON households;
DROP POLICY IF EXISTS "Parents can view their household_guardians link" ON household_guardians;
DROP POLICY IF EXISTS "Admins can view all household_guardians in their club" ON household_guardians;

-- Step 4: Policy to allow parents to view their own household
-- This is CRITICAL for nested queries like household_guardians(...).select('households(...)')
DROP POLICY IF EXISTS "Parents can view their household" ON households;
CREATE POLICY "Parents can view their household"
ON households
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = households.id
      AND hg.user_id = auth.uid()
  )
);

-- Step 5: Policy to allow admins to view all households in their club
DROP POLICY IF EXISTS "Admins can view all households in their club" ON households;
CREATE POLICY "Admins can view all households in their club"
ON households
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = households.club_id
  )
);

-- Step 6: Policy to allow parents to view their household_guardians link
-- SIMPLE: Just check if user_id matches - avoids infinite recursion
DROP POLICY IF EXISTS "Parents can view their household_guardians link" ON household_guardians;
CREATE POLICY "Parents can view their household_guardians link"
ON household_guardians
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 6.5: Add club_id to household_guardians to break circular dependency
-- FUNDAMENTAL FIX: Denormalize club_id to avoid querying households table from RLS policies
-- This eliminates the need for SECURITY DEFINER functions and breaks the circular dependency
ALTER TABLE household_guardians 
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;

-- Populate club_id from the related household
UPDATE household_guardians hg
SET club_id = h.club_id
FROM households h
WHERE hg.household_id = h.id
  AND hg.club_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_household_guardians_club_id 
  ON household_guardians(club_id);

-- Create trigger to maintain club_id when household_guardian is created/updated
-- This ensures club_id stays in sync with the household's club_id
CREATE OR REPLACE FUNCTION public.sync_household_guardian_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If club_id is not set, get it from the household
  IF NEW.club_id IS NULL AND NEW.household_id IS NOT NULL THEN
    SELECT h.club_id INTO NEW.club_id
    FROM households h
    WHERE h.id = NEW.household_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_household_guardian_club_id_trigger ON household_guardians;
CREATE TRIGGER sync_household_guardian_club_id_trigger
  BEFORE INSERT OR UPDATE ON household_guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_household_guardian_club_id();

-- Step 7: Policy to allow admins to view household_guardians in their club
-- Now we can check club_id directly without querying households - no recursion!
DROP POLICY IF EXISTS "Admins can view all household_guardians in their club" ON household_guardians;
CREATE POLICY "Admins can view all household_guardians in their club"
ON household_guardians
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'system_admin')
      AND p.club_id = household_guardians.club_id
  )
);

-- Step 8: Policy to allow parents to update their own household
-- (Already dropped in Step 3, but kept here for clarity)
CREATE POLICY "Parents can update their household"
ON households
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = households.id
      AND hg.user_id = auth.uid()
      AND hg.is_primary = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_guardians hg
    WHERE hg.household_id = households.id
      AND hg.user_id = auth.uid()
      AND hg.is_primary = true
  )
);

-- Verify policies were created
SELECT 
  'RLS Policies Created' as status,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('households', 'household_guardians')
ORDER BY tablename, policyname;

