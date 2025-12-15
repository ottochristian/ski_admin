-- Verify if clone actually copied programs

-- 1. Show all GTSSF seasons
SELECT 
  'All GTSSF Seasons' as check_type,
  s.id,
  s.name,
  s.is_current,
  s.status,
  s.start_date,
  COUNT(p.id) as program_count
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
WHERE c.slug = 'gtssf'
GROUP BY s.id, s.name, s.is_current, s.status, s.start_date
ORDER BY s.start_date DESC;

-- 2. Show programs per season with details
SELECT 
  'Programs by Season' as check_type,
  s.name as season_name,
  p.id as program_id,
  p.name as program_name,
  p.status as program_status,
  COUNT(sp.id) as subprogram_count
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'gtssf'
GROUP BY s.id, s.name, p.id, p.name, p.status
ORDER BY s.name, p.name;

-- 3. Detailed check: What exists in each season
SELECT 
  'Detailed Comparison' as check_type,
  s.name as season,
  COALESCE(p.name, 'NO PROGRAMS') as program,
  COALESCE(sp.name, 'NO SUB-PROGRAMS') as sub_program,
  sp.status as sp_status
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'gtssf'
  AND s.name LIKE '%2025-2026%'
ORDER BY s.name, p.name, sp.name;
