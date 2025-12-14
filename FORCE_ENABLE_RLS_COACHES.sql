-- Force enable RLS on coaches table and recreate policies

-- Step 1: Enable RLS (force it even if already enabled)
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'coaches'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON coaches', policy_record.policyname);
    END LOOP;
END $$;

-- Step 3: Recreate policies for admins
-- Policy for admins to SELECT coaches in their club
CREATE POLICY "Admins can view coaches in their club"
ON coaches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Policy for admins to INSERT coaches in their club
CREATE POLICY "Admins can insert coaches in their club"
ON coaches
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Policy for admins to UPDATE coaches in their club
CREATE POLICY "Admins can update coaches in their club"
ON coaches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Policy for admins to DELETE coaches in their club
CREATE POLICY "Admins can delete coaches in their club"
ON coaches
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.club_id = coaches.club_id
  )
);

-- Step 4: Add policy for coaches to view themselves
CREATE POLICY "Coaches can view their own profile"
ON coaches
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
);

-- Policy for coaches to update their own profile
CREATE POLICY "Coaches can update their own profile"
ON coaches
FOR UPDATE
TO authenticated
USING (
  profile_id = auth.uid()
)
WITH CHECK (
  profile_id = auth.uid()
);

-- Step 5: Verify policies were created
SELECT 
  'RLS Policies Recreated' as status,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'coaches'
ORDER BY cmd, policyname;

-- Step 6: Verify RLS is enabled
SELECT 
  'RLS Status' as status,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'coaches';

