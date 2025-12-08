-- Migration 26 - STEP 1: Add 'system_admin' to user_role enum
-- Run this FIRST in Supabase SQL Editor
-- Then commit/run it before proceeding to STEP 2

-- Add 'system_admin' to the enum if it doesn't exist
DO $$
BEGIN
  -- Check if user_role enum exists
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    -- Add 'system_admin' to the enum if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'system_admin' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
      ALTER TYPE user_role ADD VALUE 'system_admin';
    END IF;
  END IF;
END $$;

-- Verify it was added
SELECT 
  'Step 1 complete: Added system_admin to enum' as status,
  enumlabel as role_values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;
