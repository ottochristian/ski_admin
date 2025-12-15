-- Quick fix: Remove duplicate current seasons before running migration
-- This keeps the most recent season as current for each club

-- 1. Show current duplicate current seasons
SELECT 
  'Duplicate Current Seasons' as check_type,
  c.name as club_name,
  c.slug,
  s.name as season_name,
  s.is_current,
  s.status,
  s.start_date,
  s.created_at
FROM seasons s
JOIN clubs c ON s.club_id = c.id
WHERE s.is_current = true
ORDER BY c.name, s.start_date DESC;

-- 2. Fix: Keep only the most recent current season per club
WITH ranked_current_seasons AS (
  SELECT 
    id,
    club_id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY club_id 
      ORDER BY start_date DESC, created_at DESC
    ) as rn
  FROM seasons
  WHERE is_current = true
)
UPDATE seasons
SET is_current = false
WHERE id IN (
  SELECT id FROM ranked_current_seasons WHERE rn > 1
);

-- 3. Verify fix
SELECT 
  'After Fix' as check_type,
  c.name as club_name,
  COUNT(CASE WHEN s.is_current THEN 1 END) as current_season_count,
  STRING_AGG(s.name, ', ') FILTER (WHERE s.is_current) as current_season_name
FROM clubs c
LEFT JOIN seasons s ON s.club_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
