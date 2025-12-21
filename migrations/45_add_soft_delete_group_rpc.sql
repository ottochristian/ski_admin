-- Migration: Add soft_delete_group RPC
-- Purpose: Complete soft delete infrastructure by adding group deletion
-- Date: 2025-12-21

BEGIN;

-- =====================================================
-- Create soft_delete_group RPC function
-- =====================================================

CREATE OR REPLACE FUNCTION soft_delete_group(group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Soft delete the group
  UPDATE groups
  SET deleted_at = NOW()
  WHERE id = soft_delete_group.group_id;

  -- Note: Groups don't have child relations, so no cascading needed
END;
$$;

-- =====================================================
-- Create restore_group RPC function (for future use)
-- =====================================================

CREATE OR REPLACE FUNCTION restore_group(group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Restore the group
  UPDATE groups
  SET deleted_at = NULL
  WHERE id = restore_group.group_id;
END;
$$;

-- =====================================================
-- Grant execute permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION soft_delete_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_group(UUID) TO authenticated;

COMMIT;
