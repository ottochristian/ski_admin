-- Migration 07 - STEP 2: Update CHECK constraint (if role is text with constraint)
-- Run this SECOND, AFTER committing STEP 1
-- Only needed if role column uses a CHECK constraint instead of enum

-- Update CHECK constraint to include 'parent'
DO $$
BEGIN
  -- Check if there's a CHECK constraint on role
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%role%' 
    AND table_name = 'profiles'
    AND constraint_type = 'CHECK'
  ) THEN
    -- Find the exact constraint name
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT tc.constraint_name INTO constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'profiles'
        AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name LIKE '%role%'
      LIMIT 1;
      
      -- Drop existing constraint
      EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_name);
      
      -- Add new constraint with 'parent' included
      ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('admin', 'coach', 'parent'));
    END;
  END IF;
END $$;

-- Verify the change
SELECT 
  'Step 2 complete: Updated CHECK constraint' as status,
  (SELECT COUNT(*) FROM profiles WHERE role = 'parent') as existing_parents;
