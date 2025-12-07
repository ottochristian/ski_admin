-- Diagnostic: Check if programs exist and what they're linked to

-- 1. Check ALL programs (regardless of season/club)
SELECT 
  'All Programs' as check_type,
  p.id,
  p.name,
  p.status,
  p.season_id,
  s.name as season_name,
  s.is_current,
  p.club_id,
  c.name as club_name,
  COUNT(sp.id) as total_sub_programs,
  COUNT(CASE WHEN sp.is_active = true THEN 1 END) as active_sub_programs
FROM programs p
LEFT JOIN seasons s ON s.id = p.season_id
LEFT JOIN clubs c ON c.id = p.club_id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
GROUP BY p.id, p.name, p.status, p.season_id, s.name, s.is_current, p.club_id, c.name
ORDER BY s.is_current DESC NULLS LAST, c.name, p.name;

-- 2. Check if programs exist but are linked to wrong season
SELECT 
  'Programs by Season' as check_type,
  s.name as season_name,
  s.is_current,
  COUNT(DISTINCT p.id) as program_count,
  COUNT(DISTINCT sp.id) as total_sub_programs,
  COUNT(DISTINCT CASE WHEN sp.is_active = true THEN sp.id END) as active_sub_programs
FROM programs p
LEFT JOIN seasons s ON s.id = p.season_id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
GROUP BY s.name, s.is_current
ORDER BY s.is_current DESC NULLS LAST;

-- 3. Check if programs exist but are linked to wrong club
SELECT 
  'Programs by Club' as check_type,
  c.name as club_name,
  c.slug,
  COUNT(DISTINCT p.id) as program_count,
  COUNT(DISTINCT sp.id) as total_sub_programs,
  COUNT(DISTINCT CASE WHEN sp.is_active = true THEN sp.id END) as active_sub_programs
FROM programs p
LEFT JOIN clubs c ON c.id = p.club_id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
GROUP BY c.name, c.slug
ORDER BY c.name;

-- 4. Check programs with NULL season_id or club_id (data issues)
SELECT 
  'Programs with Missing Links' as check_type,
  p.id,
  p.name,
  p.status,
  CASE WHEN p.season_id IS NULL THEN 'MISSING' ELSE 'OK' END as season_status,
  CASE WHEN p.club_id IS NULL THEN 'MISSING' ELSE 'OK' END as club_status
FROM programs p
WHERE p.season_id IS NULL OR p.club_id IS NULL;

-- 5. Summary: What needs to be created
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM programs) as total_programs,
  (SELECT COUNT(*) FROM programs WHERE season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2') as programs_for_2025_2026,
  (SELECT COUNT(*) FROM programs WHERE club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6') as programs_for_your_club,
  (SELECT COUNT(*) FROM programs 
   WHERE season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2' 
     AND club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6') as programs_for_season_and_club;

-- 6. Check what season the existing programs are currently linked to
SELECT 
  'Current Season Links' as check_type,
  p.id,
  p.name,
  p.status,
  p.season_id,
  s.name as current_season_name,
  s.is_current,
  CASE 
    WHEN p.season_id IS NULL THEN 'NO SEASON LINKED'
    WHEN p.season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2' THEN 'CORRECT (2025-2026)'
    ELSE 'WRONG SEASON'
  END as season_status
FROM programs p
LEFT JOIN seasons s ON s.id = p.season_id
WHERE p.club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
ORDER BY p.name;

-- 7. FIX: Update all programs for your club to link to 2025-2026 season
-- ⚠️ RUN THIS ONLY AFTER VERIFYING THE DIAGNOSTIC QUERIES ABOVE ⚠️
-- This will link all 9 programs to the 2025-2026 season
UPDATE programs
SET season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2'
WHERE club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
  AND (season_id IS NULL OR season_id != '37fbe813-0737-4cd1-9094-b3e120625bd2')
RETURNING id, name, season_id;

-- 8. Verify the fix worked
SELECT 
  'Verification After Fix' as check_type,
  COUNT(*) as programs_linked_to_2025_2026,
  COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_programs,
  COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status_programs
FROM programs
WHERE club_id = '3dce1b99-de59-461e-9a00-ab4cdada9ae6'
  AND season_id = '37fbe813-0737-4cd1-9094-b3e120625bd2';
