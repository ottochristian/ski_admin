-- Diagnose why there are 108 sub-programs per club

-- Check programs
SELECT 
  'Programs Breakdown' as check_type,
  p.name,
  p.club_id,
  c.name as club_name,
  COUNT(*) as duplicate_count
FROM programs p
JOIN clubs c ON c.id = p.club_id
GROUP BY p.name, p.club_id, c.name
ORDER BY duplicate_count DESC, c.name, p.name;

-- Check sub-programs
SELECT 
  'Sub-Programs Breakdown' as check_type,
  sp.name,
  sp.club_id,
  c.name as club_name,
  COUNT(*) as duplicate_count
FROM sub_programs sp
JOIN clubs c ON c.id = sp.club_id
GROUP BY sp.name, sp.club_id, c.name
ORDER BY duplicate_count DESC, c.name, sp.name;

-- Check if there are actual duplicates (same name, same club)
SELECT 
  'Duplicate Programs' as check_type,
  p.name,
  c.name as club_name,
  COUNT(*) as count,
  array_agg(p.id) as program_ids
FROM programs p
JOIN clubs c ON c.id = p.club_id
GROUP BY p.name, c.name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check duplicate sub-programs
SELECT 
  'Duplicate Sub-Programs' as check_type,
  sp.name,
  c.name as club_name,
  COUNT(*) as count,
  array_agg(sp.id) as subprogram_ids
FROM sub_programs sp
JOIN clubs c ON c.id = sp.club_id
GROUP BY sp.name, c.name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check total counts
SELECT 
  'Total Counts' as check_type,
  (SELECT COUNT(*) FROM programs) as total_programs,
  (SELECT COUNT(*) FROM sub_programs) as total_subprograms,
  (SELECT COUNT(*) FROM groups) as total_groups,
  (SELECT COUNT(*) FROM clubs) as total_clubs;
