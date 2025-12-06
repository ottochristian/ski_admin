-- Migration 07: Add 'parent' role to user_role enum
-- This allows parents to sign up and access the parent portal
--
-- IMPORTANT: Run these in SEPARATE transactions/queries!
-- PostgreSQL requires committing enum changes before using them.

-- ============================================
-- STEP 1: Add 'parent' to enum (run this FIRST)
-- ============================================
-- If role is an enum type, add 'parent' to it
DO $$
BEGIN
  -- Check if user_role enum exists
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    -- Add 'parent' to the enum if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'parent' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
      ALTER TYPE user_role ADD VALUE 'parent';
    END IF;
  END IF;
END $$;

-- ============================================
-- STEP 2: Update CHECK constraint (run this SECOND, after committing step 1)
-- ============================================
-- If role is just a text column with CHECK constraint
DO $$
BEGIN
  -- Check if there's a CHECK constraint on role
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%role%' 
    AND table_name = 'profiles'
    AND constraint_type = 'CHECK'
  ) THEN
    -- Drop existing constraint (adjust constraint name if needed)
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    
    -- Add new constraint with 'parent' included
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
      CHECK (role IN ('admin', 'coach', 'parent'));
  END IF;
END $$;

-- ============================================
-- STEP 3: Verify (run this LAST)
-- ============================================
SELECT 
  'Role enum/constraint updated' as status,
  (SELECT COUNT(*) FROM profiles WHERE role = 'parent') as existing_parents;
