-- Quick check: Do Jackson seasons exist?

-- 1. Check Jackson club
SELECT 
    'Jackson Club' as check_type,
    id,
    name,
    slug
FROM clubs
WHERE slug = 'jackson';

-- 2. Check seasons for Jackson
SELECT 
    'Jackson Seasons' as check_type,
    s.id,
    s.name,
    s.is_current,
    s.status,
    s.start_date,
    s.end_date,
    s.club_id
FROM seasons s
JOIN clubs c ON s.club_id = c.id
WHERE c.slug = 'jackson'
ORDER BY s.start_date DESC;

-- 3. Count seasons per club
SELECT 
    'Season Count by Club' as check_type,
    c.name as club_name,
    c.slug,
    COUNT(s.id) as season_count,
    COUNT(CASE WHEN s.is_current THEN 1 END) as current_season_count
FROM clubs c
LEFT JOIN seasons s ON s.club_id = c.id
GROUP BY c.id, c.name, c.slug
ORDER BY c.name;
