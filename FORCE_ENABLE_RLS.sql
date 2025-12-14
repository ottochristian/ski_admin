-- Force enable RLS on athletes table and recreate policies

-- Step 1: Enable RLS (force it even if already enabled)
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'athletes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON athletes', policy_record.policyname);
    END LOOP;
END $$;

-- Step 3: Recreate policies for admins (these are the critical ones)
-- Policy for admins to SELECT athletes in their club
CREATE POLICY "Admins can view athletes in their club"
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

-- Policy for admins to INSERT athletes in their club
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

-- Policy for admins to UPDATE athletes in their club
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

-- Policy for admins to DELETE athletes in their club
CREATE POLICY "Admins can delete athletes in their club"
ON athletes
FOR DELETE
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

-- Step 4: Add parent policies (so parents can still access their household athletes)
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
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
);

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
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
);

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
  EXISTS (
    SELECT 1 
    FROM families f
    WHERE f.profile_id = auth.uid()
      AND f.id = athletes.family_id
  )
);

-- Step 5: Verify policies were created
SELECT 
  'RLS Policies Recreated' as status,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'athletes'
ORDER BY cmd, policyname;

-- Step 6: Verify RLS is enabled
SELECT 
  'RLS Status' as status,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'athletes';

