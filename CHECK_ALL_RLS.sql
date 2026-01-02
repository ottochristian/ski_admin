-- Comprehensive RLS Security Audit
-- Run this in Supabase SQL Editor to check all tables

-- 1. Check which tables have RLS enabled/disabled
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED - VULNERABLE!'
  END as security_status,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY rowsecurity DESC, tablename;

-- 2. Count policies per table
SELECT 
  t.tablename,
  CASE 
    WHEN t.rowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as rls_status,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'pg_%'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.rowsecurity DESC, policy_count, t.tablename;

-- 3. Show all RLS policies currently in place
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 4. Critical tables that MUST have RLS (security checklist)
SELECT 
  unnest(ARRAY[
    'clubs',
    'profiles', 
    'athletes',
    'households',
    'household_guardians',
    'registrations',
    'programs',
    'sub_programs',
    'groups',
    'seasons',
    'orders',
    'subscriptions'
  ]) as critical_table,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = unnest(ARRAY[
        'clubs',
        'profiles', 
        'athletes',
        'households',
        'household_guardians',
        'registrations',
        'programs',
        'sub_programs',
        'groups',
        'seasons',
        'orders',
        'subscriptions'
      ])
      AND rowsecurity = true
    ) THEN '✅ Protected'
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = unnest(ARRAY[
        'clubs',
        'profiles', 
        'athletes',
        'households',
        'household_guardians',
        'registrations',
        'programs',
        'sub_programs',
        'groups',
        'seasons',
        'orders',
        'subscriptions'
      ])
      AND rowsecurity = false
    ) THEN '❌ VULNERABLE!'
    ELSE '⚠️ Table does not exist'
  END as status;
