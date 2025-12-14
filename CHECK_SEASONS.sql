-- Check if seasons exist for Jackson club

-- 1. Check all seasons
SELECT 
    'All Seasons' as check_type,
    s.id,
    s.name,
    s.club_id,
    c.name as club_name,
    c.slug as club_slug,
    s.is_current,
    s.status,
    s.start_date,
    s.end_date
FROM seasons s
LEFT JOIN clubs c ON s.club_id = c.id
ORDER BY c.name, s.start_date DESC;

-- 2. Check seasons for Jackson specifically
SELECT 
    'Jackson Seasons' as check_type,
    s.id,
    s.name,
    s.is_current,
    s.status
FROM seasons s
JOIN clubs c ON s.club_id = c.id
WHERE c.slug = 'jackson'
ORDER BY s.start_date DESC;

-- 3. Check RLS on seasons table
SELECT 
    'Seasons RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'seasons';

-- 4. Check seasons RLS policies
SELECT 
    'Seasons RLS Policies' as check_type,
    policyname,
    cmd as operation,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'seasons'
ORDER BY policyname;
