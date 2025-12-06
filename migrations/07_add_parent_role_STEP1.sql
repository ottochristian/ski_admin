-- Migration 07 - STEP 1: Add 'parent' to user_role enum
-- Run this FIRST in Supabase SQL Editor
-- Then commit/run it before proceeding to STEP 2

-- Add 'parent' to the enum if it doesn't exist
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

-- Verify it was added
SELECT 
  'Step 1 complete: Added parent to enum' as status,
  enumlabel as role_values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;
