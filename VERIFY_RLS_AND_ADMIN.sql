-- Verify RLS is actually working for Jackson admin

-- 1. Check Jackson admin's profile details
SELECT 
  'Jackson Admin Profile' as check_type,
  id as user_id,
  email,
  role,
  club_id,
  (SELECT name FROM clubs WHERE id = profiles.club_id) as club_name,
  (SELECT slug FROM clubs WHERE id = profiles.club_id) as club_slug
FROM profiles
WHERE email LIKE '%jackson%admin%';

-- 2. Check if RLS is ACTUALLY enabled (not just in migration)
SELECT 
  'RLS Enabled Check' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'athletes';

-- 3. List ALL RLS policies on athletes table
SELECT 
  'All Athletes Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'athletes'
ORDER BY cmd, policyname;

-- 4. Test: What athletes SHOULD the Jackson admin see?
-- This simulates what the RLS policy should return
SELECT 
  'Expected Athletes for Jackson Admin' as check_type,
  a.id,
  a.first_name,
  a.last_name,
  a.club_id,
  (SELECT name FROM clubs WHERE id = a.club_id) as club_name
FROM athletes a
WHERE EXISTS (
  SELECT 1 
  FROM profiles p
  WHERE p.email LIKE '%jackson%admin%'
    AND p.role = 'admin'
    AND p.club_id = a.club_id
)
ORDER BY a.first_name;

-- 5. Check all athletes and their club assignments
SELECT 
  'All Athletes With Club' as check_type,
  a.first_name,
  a.last_name,
  a.club_id,
  c.name as club_name,
  c.slug as club_slug
FROM athletes a
JOIN clubs c ON c.id = a.club_id
ORDER BY c.name, a.first_name;

-- 6. IMPORTANT: Check if there's a system_admin or service_role bypass
-- If you're logged in as system_admin or using service role key, RLS is BYPASSED!
SELECT 
  'Check Current Auth Context' as check_type,
  current_user as current_db_user,
  current_setting('request.jwt.claims', true)::json->>'role' as jwt_role,
  current_setting('request.jwt.claims', true)::json->>'email' as jwt_email;
