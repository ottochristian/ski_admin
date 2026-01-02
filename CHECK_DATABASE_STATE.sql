-- Run this in Supabase SQL Editor to check database state

-- 1. Check if migration 48 tables exist
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'used_tokens'
) as used_tokens_exists;

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'rate_limits'
) as rate_limits_exists;

-- 2. Check if functions exist
SELECT EXISTS (
  SELECT FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = 'check_rate_limit'
) as check_rate_limit_exists;

-- 3. Check for any locks on tables
SELECT 
  pid,
  state,
  wait_event_type,
  wait_event,
  query_start,
  left(query, 100) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

-- 4. Check for long-running transactions
SELECT 
  pid,
  now() - xact_start AS transaction_duration,
  query_start,
  left(query, 100) as query_preview
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND now() - xact_start > interval '5 minutes'
ORDER BY xact_start;

-- 5. Test a simple auth query (should be fast)
SELECT COUNT(*) FROM auth.users;
