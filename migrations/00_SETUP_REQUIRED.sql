-- ⚠️ SETUP REQUIRED: Run migrations in this order
-- 
-- The signup process requires the clubs table to exist.
-- Run these migrations IN ORDER in Supabase SQL Editor:
--
-- 1. FIRST: Run migrations/01_add_clubs.sql
--    This creates the clubs table and adds club_id to all existing tables
--
-- 2. THEN: Run migrations/19_add_jackson_gtssf_clubs.sql (optional)
--    This adds Jackson and GTSSF clubs
--
-- 3. FINALLY: Run migrations/20_fix_signup_complete.sql
--    This fixes the handle_new_user trigger function
--
-- After running these, signup should work!

-- Quick check: Does clubs table exist?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clubs')
    THEN '✅ Clubs table exists'
    ELSE '❌ Clubs table DOES NOT EXIST - Run migrations/01_add_clubs.sql first!'
  END as status;
