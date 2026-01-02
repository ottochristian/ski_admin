-- COMPREHENSIVE SECURITY AUDIT
-- Run this in Supabase SQL Editor to find ALL vulnerable tables
-- Copy the output and share it with me

-- 1. Show ALL tables and their RLS status
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ SECURED'
    ELSE '❌ VULNERABLE'
  END as rls_status,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY rowsecurity, tablename;

-- 2. Count vulnerable tables
SELECT 
  COUNT(*) FILTER (WHERE rowsecurity = false) as vulnerable_count,
  COUNT(*) FILTER (WHERE rowsecurity = true) as secured_count,
  COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%';

-- 3. List ONLY vulnerable tables with sample row counts
SELECT 
  t.tablename,
  '❌ VULNERABLE' as status,
  (SELECT COUNT(*) FROM pg_class WHERE relname = t.tablename) as has_data
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = false
  AND t.tablename NOT LIKE 'pg_%'
ORDER BY t.tablename;

-- 4. Show which tables have policies but RLS disabled (misconfiguration)
SELECT 
  t.tablename,
  '⚠️ HAS POLICIES BUT RLS DISABLED' as issue,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = false
  AND t.tablename NOT LIKE 'pg_%'
GROUP BY t.tablename
HAVING COUNT(p.policyname) > 0;
