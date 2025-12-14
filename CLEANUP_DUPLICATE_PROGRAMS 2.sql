-- Clean up duplicate programs and sub-programs
-- Keep only ONE of each program/sub-program per club

-- ============================================
-- STEP 1: Identify and keep only the first occurrence
-- ============================================

-- Create temp table with programs to KEEP (one per name per club)
CREATE TEMP TABLE programs_to_keep AS
SELECT DISTINCT ON (club_id, name)
  id
FROM programs
ORDER BY club_id, name, created_at ASC;

-- Create temp table with sub_programs to KEEP
CREATE TEMP TABLE subprograms_to_keep AS
SELECT DISTINCT ON (club_id, name, program_id)
  id
FROM sub_programs
ORDER BY club_id, name, program_id, created_at ASC;

-- ============================================
-- STEP 2: Delete dependencies first (to avoid foreign key errors)
-- ============================================

-- Delete coach_assignments for sub-programs we're deleting
DELETE FROM coach_assignments
WHERE sub_program_id NOT IN (SELECT id FROM subprograms_to_keep);

-- Delete groups for sub-programs we're deleting
DELETE FROM groups
WHERE sub_program_id NOT IN (SELECT id FROM subprograms_to_keep);

-- Delete registrations for programs/sub-programs we're deleting
-- (This might be complex, so let's check first)
-- For now, skip registrations cleanup to be safe

-- ============================================
-- STEP 3: Delete duplicate sub-programs
-- ============================================

DELETE FROM sub_programs
WHERE id NOT IN (SELECT id FROM subprograms_to_keep);

-- ============================================
-- STEP 4: Delete duplicate programs
-- ============================================

DELETE FROM programs
WHERE id NOT IN (SELECT id FROM programs_to_keep);

-- ============================================
-- STEP 5: Verification
-- ============================================

-- Check programs per club (should be ~3 each)
SELECT 
  'Programs After Cleanup' as check_type,
  c.name as club_name,
  COUNT(DISTINCT p.id) as program_count,
  array_agg(DISTINCT p.name ORDER BY p.name) as programs
FROM clubs c
LEFT JOIN programs p ON p.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Check sub-programs per club (should be ~9 each)
SELECT 
  'Sub-Programs After Cleanup' as check_type,
  c.name as club_name,
  COUNT(sp.id) as subprogram_count
FROM clubs c
LEFT JOIN sub_programs sp ON sp.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Show remaining duplicates (should be 0)
SELECT 
  'Remaining Duplicates' as check_type,
  p.name,
  c.name as club_name,
  COUNT(*) as count
FROM programs p
JOIN clubs c ON c.id = p.club_id
GROUP BY p.name, c.name
HAVING COUNT(*) > 1;
