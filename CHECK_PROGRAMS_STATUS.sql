-- Check if programs still exist and which club they belong to

-- 1. Check all programs
SELECT 
  'All Programs' as check_type,
  p.id,
  p.name,
  p.club_id,
  c.name as club_name,
  c.slug as club_slug
FROM programs p
LEFT JOIN clubs c ON c.id = p.club_id
ORDER BY c.name, p.name;

-- 2. Check programs per club
SELECT 
  'Programs Per Club' as check_type,
  c.name as club_name,
  c.slug as club_slug,
  COUNT(p.id) as program_count,
  array_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL) as programs
FROM clubs c
LEFT JOIN programs p ON p.club_id = c.id
GROUP BY c.id, c.name, c.slug
ORDER BY c.name;

-- 3. Check Jackson club specifically
SELECT 
  'Jackson Club Programs' as check_type,
  p.id,
  p.name,
  p.description
FROM programs p
JOIN clubs c ON c.id = p.club_id
WHERE c.slug = 'jackson'
ORDER BY p.name;

-- 4. Check if club_id is NULL for any programs
SELECT 
  'Programs with NULL club_id' as check_type,
  id,
  name,
  club_id
FROM programs
WHERE club_id IS NULL;

-- 5. Check seasons
SELECT 
  'Seasons' as check_type,
  s.id,
  s.name,
  s.club_id,
  c.name as club_name,
  c.slug as club_slug,
  (SELECT COUNT(*) FROM programs WHERE season_id = s.id) as program_count
FROM seasons s
LEFT JOIN clubs c ON c.id = s.club_id
ORDER BY c.name, s.name;
