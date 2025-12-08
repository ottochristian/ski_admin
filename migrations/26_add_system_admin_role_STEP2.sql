-- Migration 26 - STEP 2: Update CHECK constraint (if role is text with constraint)
-- Run this SECOND, AFTER committing STEP 1
-- Only needed if role column uses a CHECK constraint instead of enum

-- Update CHECK constraint to include 'system_admin'
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Check if there's a CHECK constraint on role
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%role%' 
    AND table_name = 'profiles'
    AND constraint_type = 'CHECK'
  ) THEN
    -- Find the exact constraint name
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'profiles'
      AND tc.constraint_type = 'CHECK'
      AND tc.constraint_name LIKE '%role%'
    LIMIT 1;
    
    -- Drop existing constraint
    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_name);
      
      -- Add new constraint with 'system_admin' included
      ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('admin', 'coach', 'parent', 'system_admin'));
    END IF;
  END IF;
END $$;

-- Verify the change
SELECT 
  'Step 2 complete: Updated CHECK constraint' as status,
  (SELECT COUNT(*) FROM profiles WHERE role = 'system_admin') as existing_system_admins;
