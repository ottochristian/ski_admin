-- Fix: Switch current season to the one with Alpine + Nordic programs

-- 1. Current state
SELECT 
  'Before Fix' as status,
  s.name as season_name,
  s.is_current,
  s.status,
  COUNT(p.id) as program_count,
  STRING_AGG(p.name, ', ') as programs
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
WHERE c.slug = 'gtssf'
GROUP BY s.id, s.name, s.is_current, s.status
ORDER BY s.name;

-- 2. Make "2025-2026" (the one with Alpine + Nordic) the current season
UPDATE seasons
SET 
  is_current = true,
  status = 'active'
FROM clubs c
WHERE seasons.club_id = c.id
  AND c.slug = 'gtssf'
  AND seasons.name = '2025-2026';

-- 3. Make "2025-2026 v2" NOT current (archive it or keep as draft)
UPDATE seasons
SET 
  is_current = false,
  status = 'draft'  -- or 'archived' if you don't want to see it
FROM clubs c
WHERE seasons.club_id = c.id
  AND c.slug = 'gtssf'
  AND seasons.name = '2025-2026 v2';

-- 4. Verify the fix
SELECT 
  'After Fix' as status,
  s.name as season_name,
  s.is_current,
  s.status,
  COUNT(p.id) as program_count,
  STRING_AGG(p.name, ', ') as programs
FROM seasons s
JOIN clubs c ON s.club_id = c.id
LEFT JOIN programs p ON p.season_id = s.id
WHERE c.slug = 'gtssf'
GROUP BY s.id, s.name, s.is_current, s.status
ORDER BY s.name;
