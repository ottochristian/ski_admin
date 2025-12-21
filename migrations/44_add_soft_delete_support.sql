-- Migration: Add Soft Delete Support
-- Purpose: Add deleted_at columns and soft delete RPC for programs, sub_programs, groups
-- Date: 2025-12-21

BEGIN;

-- =====================================================
-- 1. Add deleted_at columns to all relevant tables
-- =====================================================

-- Programs
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Sub-programs
ALTER TABLE sub_programs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Groups
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Registrations (for future use)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Coach assignments (for future use)
ALTER TABLE coach_assignments 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =====================================================
-- 2. Create indexes for soft delete queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_programs_deleted_at 
ON programs(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sub_programs_deleted_at 
ON sub_programs(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_groups_deleted_at 
ON groups(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- 3. Create soft_delete_program RPC function
-- =====================================================

CREATE OR REPLACE FUNCTION soft_delete_program(program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_program_ids UUID[];
BEGIN
  -- Get all sub-program IDs for this program
  SELECT ARRAY_AGG(id) INTO sub_program_ids
  FROM sub_programs
  WHERE sub_programs.program_id = soft_delete_program.program_id;

  -- Soft delete the program
  UPDATE programs
  SET deleted_at = NOW()
  WHERE id = soft_delete_program.program_id;

  -- Soft delete all sub-programs
  UPDATE sub_programs
  SET deleted_at = NOW()
  WHERE sub_programs.program_id = soft_delete_program.program_id;

  -- Soft delete all groups for these sub-programs
  IF sub_program_ids IS NOT NULL THEN
    UPDATE groups
    SET deleted_at = NOW()
    WHERE sub_program_id = ANY(sub_program_ids);
  END IF;

  -- Note: We do NOT soft delete registrations or coach_assignments
  -- to preserve historical data and relationships
END;
$$;

-- =====================================================
-- 4. Create soft_delete_sub_program RPC function
-- =====================================================

CREATE OR REPLACE FUNCTION soft_delete_sub_program(sub_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Soft delete the sub-program
  UPDATE sub_programs
  SET deleted_at = NOW()
  WHERE id = soft_delete_sub_program.sub_program_id;

  -- Soft delete all groups for this sub-program
  UPDATE groups
  SET deleted_at = NOW()
  WHERE groups.sub_program_id = soft_delete_sub_program.sub_program_id;

  -- Note: We do NOT soft delete registrations or coach_assignments
  -- to preserve historical data and relationships
END;
$$;

-- =====================================================
-- 5. Create restore functions (for future use)
-- =====================================================

CREATE OR REPLACE FUNCTION restore_program(program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_program_ids UUID[];
BEGIN
  -- Get all sub-program IDs for this program
  SELECT ARRAY_AGG(id) INTO sub_program_ids
  FROM sub_programs
  WHERE sub_programs.program_id = restore_program.program_id;

  -- Restore the program
  UPDATE programs
  SET deleted_at = NULL
  WHERE id = restore_program.program_id;

  -- Restore all sub-programs
  UPDATE sub_programs
  SET deleted_at = NULL
  WHERE sub_programs.program_id = restore_program.program_id;

  -- Restore all groups for these sub-programs
  IF sub_program_ids IS NOT NULL THEN
    UPDATE groups
    SET deleted_at = NULL
    WHERE sub_program_id = ANY(sub_program_ids);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION restore_sub_program(sub_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Restore the sub-program
  UPDATE sub_programs
  SET deleted_at = NULL
  WHERE id = restore_sub_program.sub_program_id;

  -- Restore all groups for this sub-program
  UPDATE groups
  SET deleted_at = NULL
  WHERE groups.sub_program_id = restore_sub_program.sub_program_id;
END;
$$;

-- =====================================================
-- 6. Grant execute permissions
-- =====================================================

-- Allow authenticated users to call soft delete functions
GRANT EXECUTE ON FUNCTION soft_delete_program(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_sub_program(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_program(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_sub_program(UUID) TO authenticated;

COMMIT;

-- =====================================================
-- Verification queries (run separately to test)
-- =====================================================

-- Check columns were added:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name IN ('programs', 'sub_programs', 'groups') 
-- AND column_name = 'deleted_at';

-- Check functions were created:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name LIKE '%delete%program%';
