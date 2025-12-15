-- Check Jackson programs and activation status

-- 1. Show all Jackson seasons
SELECT 
  'All Jackson Seasons' as check_type,
  s.id,
  s.name,
  s.is_current,
  s.status,
  s.start_date,
  COUNT(p.id) as program_count,
  COUNT(CASE WHEN p.status = 'ACTIVE' THEN 1 END) as active_programs,
  COUNT(CASE WHEN p.status = 'INACTIVE' THEN 1 END) as inactive_programs
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
WHERE c.slug = 'jackson'
GROUP BY s.id, s.name, s.is_current, s.status, s.start_date
ORDER BY s.start_date DESC;

-- 2. Show programs with their status
SELECT 
  'Programs Detail' as check_type,
  s.name as season_name,
  p.name as program_name,
  p.status as program_status,
  COUNT(sp.id) as subprogram_count,
  COUNT(CASE WHEN sp.status = 'ACTIVE' THEN 1 END) as active_subprograms,
  COUNT(CASE WHEN sp.status = 'INACTIVE' THEN 1 END) as inactive_subprograms
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'jackson'
GROUP BY s.id, s.name, p.id, p.name, p.status
ORDER BY s.name, p.name;

-- 3. Show sub-programs for current season
SELECT 
  'Sub-Programs for Current Season' as check_type,
  p.name as program_name,
  sp.name as subprogram_name,
  sp.status as subprogram_status,
  sp.registration_fee
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'jackson'
  AND s.is_current = true
ORDER BY p.name, sp.name;
