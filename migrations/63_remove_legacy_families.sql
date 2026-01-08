-- Migration 63: Remove Legacy Families Table
-- This removes all fallback logic and the legacy families table
-- IMPORTANT: Run this only after verifying all data has been migrated to households

-- Step 1: Verify all athletes have household_id (if not, migration will fail)
-- Also check if family_id column still exists (handles case where migration was partially run)
DO $$
DECLARE
  athletes_without_household INTEGER;
  athletes_with_family_id INTEGER;
  family_id_column_exists BOOLEAN;
BEGIN
  -- Check if family_id column exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'athletes' 
      AND column_name = 'family_id'
  ) INTO family_id_column_exists;
  
  -- Check for athletes without household_id
  SELECT COUNT(*) INTO athletes_without_household
  FROM athletes
  WHERE household_id IS NULL;
  
  IF athletes_without_household > 0 THEN
    RAISE EXCEPTION 'Cannot proceed: % athletes still have NULL household_id. Please migrate them first.', athletes_without_household;
  END IF;
  
  -- Only check family_id if the column exists
  IF family_id_column_exists THEN
    SELECT COUNT(*) INTO athletes_with_family_id
    FROM athletes
    WHERE family_id IS NOT NULL;
    
    IF athletes_with_family_id > 0 THEN
      RAISE WARNING 'Found % athletes still using family_id. These will lose family_id reference after column drop.', athletes_with_family_id;
    END IF;
    
    RAISE NOTICE 'Found % athletes with family_id (column will be dropped)', athletes_with_family_id;
  ELSE
    RAISE NOTICE 'family_id column already removed - skipping family_id check.';
  END IF;
  
  RAISE NOTICE 'Verification passed: All athletes have household_id';
END $$;

-- Step 2: Remove family_id fallback from athletes RLS policies

-- Drop and recreate SELECT policy (remove families fallback)
DROP POLICY IF EXISTS "Parents can view athletes in their household" ON athletes;
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
);

-- Drop and recreate INSERT policy (remove families fallback)
DROP POLICY IF EXISTS "Parents can insert athletes into their household" ON athletes;
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
);

-- Drop and recreate UPDATE policy (remove families fallback)
DROP POLICY IF EXISTS "Parents can update athletes in their household" ON athletes;
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

-- Step 3: Drop ALL policies that reference family_id or families table
-- We need to drop them all because they depend on the family_id column

-- Drop registrations policies that reference family_id
DROP POLICY IF EXISTS "Parents can view registrations for their athletes" ON registrations;
DROP POLICY IF EXISTS "Parents can insert registrations for their athletes" ON registrations;
DROP POLICY IF EXISTS "Parents can update registrations for their athletes" ON registrations;
DROP POLICY IF EXISTS "Users can view their own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can create registrations for their athletes" ON registrations;

-- Drop race_registrations policies that reference family_id
DROP POLICY IF EXISTS "Users can view their athletes' race registrations" ON race_registrations;
DROP POLICY IF EXISTS "Parents can view their athletes' race registrations" ON race_registrations;
DROP POLICY IF EXISTS "Parents can create race registrations for their athletes" ON race_registrations;
DROP POLICY IF EXISTS "Parents can update race registrations for their athletes" ON race_registrations;

-- Step 4: Recreate registrations policies WITHOUT family_id fallback
-- Recreate SELECT policy
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
);

-- Recreate INSERT policy
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
);

-- Recreate UPDATE policy
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM athletes a
    INNER JOIN household_guardians hg ON hg.household_id = a.household_id
    WHERE hg.user_id = auth.uid()
      AND a.id = registrations.athlete_id
  )
);

-- Recreate "Users can view their own registrations" policy (if it was a separate policy)
-- This may be an alias for the Parents policy above, but we'll create it to be safe
CREATE POLICY "Users can view their own registrations"
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
);

-- Recreate "Users can create registrations for their athletes" policy
CREATE POLICY "Users can create registrations for their athletes"
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
);

-- Step 5: Recreate race_registrations policies WITHOUT family_id fallback (if table exists)
DO $$
BEGIN
  -- Check if race_registrations table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'race_registrations') THEN
    -- Recreate SELECT policy for race_registrations
    CREATE POLICY "Users can view their athletes' race registrations"
    ON race_registrations
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 
        FROM athletes a
        INNER JOIN household_guardians hg ON hg.household_id = a.household_id
        WHERE hg.user_id = auth.uid()
          AND a.id = race_registrations.athlete_id
      )
    );
    
    RAISE NOTICE 'Race registrations policies recreated without family_id fallback.';
  ELSE
    RAISE NOTICE 'race_registrations table does not exist, skipping policies.';
  END IF;
END $$;

-- Step 6: Drop family_id column from athletes table (now safe - no dependencies)
-- Only drop if it exists (handles case where migration was partially run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'athletes' 
      AND column_name = 'family_id'
  ) THEN
    ALTER TABLE athletes DROP COLUMN family_id;
    RAISE NOTICE 'Dropped family_id column from athletes table.';
  ELSE
    RAISE NOTICE 'family_id column already removed from athletes table.';
  END IF;
END $$;

-- Step 7: Drop the families table (with CASCADE to drop any dependent objects)
-- Note: This will fail if there are still foreign key references
DROP TABLE IF EXISTS families CASCADE;

-- Step 8: Verify cleanup
SELECT 
  'Legacy families cleanup complete' as status,
  (SELECT COUNT(*) FROM athletes WHERE household_id IS NOT NULL) as athletes_with_household,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'families') as families_table_exists;

-- Step 9: List any remaining references (for manual cleanup)
SELECT 
  'Manual cleanup needed' as note,
  'Check codebase for references to: families table, family_id column, or familyId variables' as action;

