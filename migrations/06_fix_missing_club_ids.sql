-- Migration 06: Fix Missing Club IDs
-- Run this if programs/athletes/etc don't have club_id set
-- This ensures all existing data has the default club assigned

-- Step 1: Get the default club ID
DO $$
DECLARE
  default_club_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get default club
  SELECT id INTO default_club_id FROM clubs WHERE slug = 'default' LIMIT 1;
  
  IF default_club_id IS NULL THEN
    RAISE EXCEPTION 'Default club not found. Run migration 01 first.';
  END IF;
  
  -- Update programs without club_id
  UPDATE programs 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % programs', updated_count;
  
  -- Update athletes without club_id
  UPDATE athletes 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % athletes', updated_count;
  
  -- Update sub_programs without club_id
  UPDATE sub_programs 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % sub_programs', updated_count;
  
  -- Update registrations without club_id
  UPDATE registrations 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % registrations', updated_count;
  
  -- Update groups without club_id
  UPDATE groups 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % groups', updated_count;
  
  -- Update coaches without club_id
  UPDATE coaches 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % coaches', updated_count;
  
  -- Update families without club_id
  UPDATE families 
  SET club_id = default_club_id 
  WHERE club_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % families', updated_count;
  
  RAISE NOTICE 'Migration complete!';
END $$;

-- Verify
SELECT 
  'Programs with club_id' as check_type,
  COUNT(*) as count
FROM programs 
WHERE club_id IS NOT NULL
UNION ALL
SELECT 
  'Programs without club_id' as check_type,
  COUNT(*) as count
FROM programs 
WHERE club_id IS NULL;

