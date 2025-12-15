-- Check GTSSF programs and sub-programs configuration

-- 1. Check current season for GTSSF
SELECT 
  'Current Season' as check_type,
  s.id,
  s.name,
  s.is_current,
  s.status,
  c.name as club_name
FROM seasons s
JOIN clubs c ON s.club_id = c.id
WHERE c.slug = 'gtssf' AND s.is_current = true;

-- 2. Check programs for current GTSSF season
SELECT 
  'Programs' as check_type,
  p.id,
  p.name,
  p.status,
  p.season_id,
  s.name as season_name
FROM programs p
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON p.club_id = c.id
WHERE c.slug = 'gtssf' 
  AND s.is_current = true
ORDER BY p.name;

-- 3. Check sub-programs for GTSSF programs
SELECT 
  'Sub-Programs' as check_type,
  sp.id,
  sp.name,
  sp.status,
  sp.registration_fee,
  sp.max_capacity,
  p.name as program_name,
  CASE 
    WHEN sp.status = 'ACTIVE' THEN 'Active ✓'
    WHEN sp.status = 'INACTIVE' THEN 'Inactive ✗'
    ELSE sp.status
  END as status_display
FROM sub_programs sp
JOIN programs p ON sp.program_id = p.id
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON p.club_id = c.id
WHERE c.slug = 'gtssf' 
  AND s.is_current = true
ORDER BY p.name, sp.name;

-- 4. Summary count
SELECT 
  'Summary' as check_type,
  COUNT(DISTINCT p.id) as program_count,
  COUNT(DISTINCT sp.id) as total_subprograms,
  COUNT(DISTINCT CASE WHEN sp.status = 'ACTIVE' THEN sp.id END) as active_subprograms,
  COUNT(DISTINCT CASE WHEN sp.status = 'INACTIVE' THEN sp.id END) as inactive_subprograms
FROM programs p
LEFT JOIN sub_programs sp ON sp.program_id = p.id
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON p.club_id = c.id
WHERE c.slug = 'gtssf' 
  AND s.is_current = true;
