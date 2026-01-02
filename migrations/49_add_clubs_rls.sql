-- Migration 49: Add RLS policies for clubs table
-- CRITICAL SECURITY FIX: clubs table was public without RLS
-- This allows:
-- - System admins to manage all clubs
-- - Admins to view and update their own club
-- - Prevents unauthorized access to club data

-- Step 1: Enable RLS on clubs table
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (safety measure)
DROP POLICY IF EXISTS "System admins can view all clubs" ON clubs;
DROP POLICY IF EXISTS "Admins can view their own club" ON clubs;
DROP POLICY IF EXISTS "System admins can insert clubs" ON clubs;
DROP POLICY IF EXISTS "System admins can update clubs" ON clubs;
DROP POLICY IF EXISTS "Admins can update their own club" ON clubs;
DROP POLICY IF EXISTS "System admins can delete clubs" ON clubs;

-- Step 3: SELECT policies
-- System admins can view all clubs
CREATE POLICY "System admins can view all clubs"
ON clubs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Admins can view their own club
CREATE POLICY "Admins can view their own club"
ON clubs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coach')
      AND p.club_id = clubs.id
  )
  OR
  -- Parents can view their club through household
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN household_guardians hg ON hg.user_id = p.id
    JOIN households h ON h.id = hg.household_id
    WHERE p.id = auth.uid()
      AND h.club_id = clubs.id
  )
);

-- Step 4: INSERT policies
-- Only system admins can create clubs
CREATE POLICY "System admins can insert clubs"
ON clubs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Step 5: UPDATE policies
-- System admins can update any club
CREATE POLICY "System admins can update clubs"
ON clubs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Admins can update their own club (limited fields via application logic)
CREATE POLICY "Admins can update their own club"
ON clubs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = clubs.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = clubs.id
  )
);

-- Step 6: DELETE policies
-- Only system admins can delete clubs (soft delete is preferred)
CREATE POLICY "System admins can delete clubs"
ON clubs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
);

-- Step 7: Verify policies were created
SELECT 
  'Clubs RLS Policies Created' as status,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'clubs'
ORDER BY cmd, policyname;

-- Step 8: Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'clubs';
