-- Activate all programs and sub-programs for Jackson's current season

-- 1. Show what will be activated
SELECT 
  'Before Activation' as status,
  s.name as season_name,
  p.name as program_name,
  p.status as program_status,
  COUNT(sp.id) as total_subprograms,
  COUNT(CASE WHEN sp.status = 'INACTIVE' THEN 1 END) as inactive_subprograms
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'jackson'
  AND s.is_current = true
GROUP BY s.id, s.name, p.id, p.name, p.status
ORDER BY p.name;

-- 2. Activate all programs for Jackson's current season
UPDATE programs
SET status = 'ACTIVE'
FROM seasons s
JOIN clubs c ON s.club_id = c.id
WHERE programs.season_id = s.id
  AND c.slug = 'jackson'
  AND s.is_current = true
  AND programs.status = 'INACTIVE';

-- 3. Activate all sub-programs for Jackson's current season
UPDATE sub_programs
SET status = 'ACTIVE'
FROM programs p
JOIN seasons s ON p.season_id = s.id
JOIN clubs c ON s.club_id = c.id
WHERE sub_programs.program_id = p.id
  AND c.slug = 'jackson'
  AND s.is_current = true
  AND sub_programs.status = 'INACTIVE';

-- 4. Verify activation
SELECT 
  'After Activation' as status,
  s.name as season_name,
  p.name as program_name,
  p.status as program_status,
  COUNT(sp.id) as total_subprograms,
  COUNT(CASE WHEN sp.status = 'ACTIVE' THEN 1 END) as active_subprograms
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
LEFT JOIN sub_programs sp ON sp.program_id = p.id
WHERE c.slug = 'jackson'
  AND s.is_current = true
GROUP BY s.id, s.name, p.id, p.name, p.status
ORDER BY p.name;
