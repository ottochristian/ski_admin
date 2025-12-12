-- Diagnostic script to check club filtering and branding issues

-- 1. Check if Jackson admin has correct club_id
SELECT 
  'Jackson Admin Profile Check' as check_type,
  id,
  email,
  role,
  club_id,
  (SELECT slug FROM clubs WHERE id = profiles.club_id) as club_slug
FROM profiles
WHERE email LIKE '%jackson%admin%'
ORDER BY email;

-- 2. Check athletes and their club_ids
SELECT 
  'Athletes Club Assignment' as check_type,
  id,
  first_name,
  last_name,
  club_id,
  (SELECT slug FROM clubs WHERE id = athletes.club_id) as club_slug,
  (SELECT name FROM clubs WHERE id = athletes.club_id) as club_name
FROM athletes
ORDER BY club_id, first_name;

-- 3. Check if RLS is enabled on athletes table
SELECT 
  'RLS Status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'athletes';

-- 4. Check RLS policies on athletes table
SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'athletes'
ORDER BY policyname;

-- 5. Check clubs table for logo_url
SELECT 
  'Club Branding' as check_type,
  id,
  name,
  slug,
  logo_url,
  primary_color
FROM clubs
ORDER BY name;

-- 6. Count athletes per club
SELECT 
  'Athletes Per Club Count' as check_type,
  c.name as club_name,
  c.slug as club_slug,
  COUNT(a.id) as athlete_count
FROM clubs c
LEFT JOIN athletes a ON a.club_id = c.id
GROUP BY c.id, c.name, c.slug
ORDER BY c.name;
