-- ============================================================================
-- GENERATE TEST DATA SCRIPT
-- ============================================================================
-- This script:
-- 1. Preserves system admin account (ottilieotto@gmail.com)
-- 2. Preserves GTSSF and Jackson clubs
-- 3. Deletes all other data
-- 4. Generates test users with format: ottilieotto+[club]+[role]+[identifier]@gmail.com
-- 5. Sets password to "test12345" for all test users
-- 6. First name = club name, Last name = role + identifier
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Get IDs we want to preserve
DO $$
DECLARE
  system_admin_email TEXT := 'ottilieotto@gmail.com';
  system_admin_id UUID;
  gtssf_club_id UUID;
  jackson_club_id UUID;
BEGIN
  -- Get system admin user ID
  SELECT id INTO system_admin_id
  FROM auth.users
  WHERE email = system_admin_email;
  
  -- Get club IDs
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1;
  SELECT id INTO jackson_club_id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1;
  
  -- Store for later use
  PERFORM set_config('app.system_admin_id', system_admin_id::text, false);
  PERFORM set_config('app.gtssf_club_id', gtssf_club_id::text, false);
  PERFORM set_config('app.jackson_club_id', jackson_club_id::text, false);
END $$;

-- Step 2: Delete all data except preserved items
DO $$
DECLARE
  system_admin_email TEXT := 'ottilieotto@gmail.com';
  system_admin_id UUID;
  gtssf_club_id UUID;
  jackson_club_id UUID;
BEGIN
  -- Get IDs
  SELECT id INTO system_admin_id FROM auth.users WHERE email = system_admin_email;
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1;
  SELECT id INTO jackson_club_id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1;
  
  -- Delete in order (respecting foreign keys)
  -- Must delete in reverse dependency order (children before parents)
  
  -- Delete order_items first (references registrations via registration_id)
  DELETE FROM order_items;
  
  -- Delete payments (may reference orders)
  DELETE FROM payments;
  
  -- Delete orders
  DELETE FROM orders;
  
  -- Delete registrations (now safe since order_items are deleted)
  DELETE FROM registrations;
  
  -- Delete webhook_events (may reference orders/registrations)
  DELETE FROM webhook_events;
  
  -- Delete athletes
  DELETE FROM athletes;
  
  -- Delete coach assignments
  DELETE FROM coach_assignments;
  
  -- Delete ALL coaches (we'll recreate them in Part 2)
  -- Must delete coaches before deleting clubs (they reference clubs via club_id)
  DELETE FROM coaches;
  
  -- Delete groups
  DELETE FROM groups;
  
  -- Delete sub_programs
  DELETE FROM sub_programs;
  
  -- Delete programs
  DELETE FROM programs;
  
  -- Delete seasons (except those for our clubs)
  DELETE FROM seasons WHERE club_id NOT IN (COALESCE(gtssf_club_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(jackson_club_id, '00000000-0000-0000-0000-000000000000'::uuid));
  
  -- Delete household_guardians
  DELETE FROM household_guardians;
  
  -- Delete households (except those for our clubs)
  DELETE FROM households WHERE club_id NOT IN (COALESCE(gtssf_club_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(jackson_club_id, '00000000-0000-0000-0000-000000000000'::uuid));
  
  -- Delete profiles (except system admin)
  -- But first, handle system admin's club_id
  -- System admin shouldn't have a club, but if column has NOT NULL constraint,
  -- assign to GTSSF temporarily (will be set back later if needed)
  IF system_admin_id IS NOT NULL THEN
    -- Update system admin's club_id if it references a club being deleted
    UPDATE profiles 
    SET club_id = COALESCE(gtssf_club_id, jackson_club_id) 
    WHERE id = system_admin_id 
      AND club_id IS NOT NULL
      AND club_id NOT IN (COALESCE(gtssf_club_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(jackson_club_id, '00000000-0000-0000-0000-000000000000'::uuid));
    
    -- Ensure system admin has a club_id (temporarily assign to GTSSF if NULL)
    -- Note: This is only if column has NOT NULL constraint
    -- You may want to make club_id nullable for system_admin role after cleanup
    UPDATE profiles 
    SET club_id = COALESCE(gtssf_club_id, jackson_club_id) 
    WHERE id = system_admin_id 
      AND club_id IS NULL
      AND (SELECT is_nullable FROM information_schema.columns 
           WHERE table_schema = 'public' 
           AND table_name = 'profiles' 
           AND column_name = 'club_id') = 'NO';
  END IF;
  
  -- Delete profiles (except system admin)
  DELETE FROM profiles WHERE id != COALESCE(system_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Delete auth users (except system admin) - This uses Supabase auth admin functions
  -- Note: You may need to run this manually in Supabase Dashboard > Authentication > Users
  -- Or use the Supabase Management API
  
  -- Delete clubs (except GTSSF and Jackson)
  -- Now safe since:
  -- - All profiles (except system admin with valid club_id) are deleted
  -- - All coaches are deleted
  -- - All other dependent records are deleted
  DELETE FROM clubs WHERE id NOT IN (COALESCE(gtssf_club_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(jackson_club_id, '00000000-0000-0000-0000-000000000000'::uuid));
  
  -- Optional: After cleanup, you may want to make club_id nullable for system_admin role
  -- This would require: ALTER TABLE profiles ALTER COLUMN club_id DROP NOT NULL;
  -- Then: UPDATE profiles SET club_id = NULL WHERE role = 'system_admin';
  
  RAISE NOTICE 'Data deleted (except system admin and GTSSF/Jackson clubs)';
END $$;

-- Step 3: Create helper function to create users with password
-- Note: Supabase uses crypt() for password hashing, but we need to use auth.users
-- For creating users programmatically, we'll need to use Supabase Auth Admin API
-- OR create a migration that uses extensions

-- Since we can't directly hash passwords in SQL without extensions,
-- we'll create the profiles and provide instructions for setting passwords
-- OR we can use Supabase's auth.users.insert() via a function

-- Create seasons for both clubs
DO $$
DECLARE
  gtssf_club_id UUID;
  jackson_club_id UUID;
  gtssf_season_id UUID;
  jackson_season_id UUID;
BEGIN
  -- Get club IDs
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1;
  SELECT id INTO jackson_club_id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1;
  
  -- Create season for GTSSF (2024-2025 season)
  INSERT INTO seasons (club_id, name, start_date, end_date, is_current, status)
  VALUES (
    gtssf_club_id,
    '2024-2025 Season',
    '2024-09-01',
    '2025-05-31',
    true,
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO gtssf_season_id;
  
  -- If season already exists, get its ID
  IF gtssf_season_id IS NULL THEN
    SELECT id INTO gtssf_season_id FROM seasons WHERE club_id = gtssf_club_id AND is_current = true LIMIT 1;
  END IF;
  
  -- Create season for Jackson (2024-2025 season)
  INSERT INTO seasons (club_id, name, start_date, end_date, is_current, status)
  VALUES (
    jackson_club_id,
    '2024-2025 Season',
    '2024-09-01',
    '2025-05-31',
    true,
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO jackson_season_id;
  
  -- If season already exists, get its ID
  IF jackson_season_id IS NULL THEN
    SELECT id INTO jackson_season_id FROM seasons WHERE club_id = jackson_club_id AND is_current = true LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Seasons created/verified';
END $$;

-- Step 4: Create test users
-- We'll create a table to store user info, then create them
-- Note: Actual user creation with passwords requires Supabase Auth Admin API
-- This script creates the structure - you'll need to set passwords via Supabase Dashboard or API

CREATE TEMP TABLE IF NOT EXISTS test_users_to_create (
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  club_id UUID,
  club_name TEXT
);

-- Clear any existing data
TRUNCATE TABLE test_users_to_create;

-- Insert test user definitions
INSERT INTO test_users_to_create (email, first_name, last_name, role, club_id, club_name)
VALUES
  -- GTSSF Admins
  ('ottilieotto+gtssf+admin+a@gmail.com', 'GTSSF', 'Admin A', 'admin', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  ('ottilieotto+gtssf+admin+b@gmail.com', 'GTSSF', 'Admin B', 'admin', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  
  -- GTSSF Coaches
  ('ottilieotto+gtssf+coach+a@gmail.com', 'GTSSF', 'Coach A', 'coach', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  ('ottilieotto+gtssf+coach+b@gmail.com', 'GTSSF', 'Coach B', 'coach', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  
  -- GTSSF Parents
  ('ottilieotto+gtssf+parent+a@gmail.com', 'GTSSF', 'Parent A', 'parent', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  ('ottilieotto+gtssf+parent+b@gmail.com', 'GTSSF', 'Parent B', 'parent', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  ('ottilieotto+gtssf+parent+c@gmail.com', 'GTSSF', 'Parent C', 'parent', (SELECT id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1), 'GTSSF'),
  
  -- Jackson Admins
  ('ottilieotto+jackson+admin+a@gmail.com', 'Jackson', 'Admin A', 'admin', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson'),
  ('ottilieotto+jackson+admin+b@gmail.com', 'Jackson', 'Admin B', 'admin', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson'),
  
  -- Jackson Coaches
  ('ottilieotto+jackson+coach+a@gmail.com', 'Jackson', 'Coach A', 'coach', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson'),
  ('ottilieotto+jackson+coach+b@gmail.com', 'Jackson', 'Coach B', 'coach', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson'),
  
  -- Jackson Parents
  ('ottilieotto+jackson+parent+a@gmail.com', 'Jackson', 'Parent A', 'parent', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson'),
  ('ottilieotto+jackson+parent+b@gmail.com', 'Jackson', 'Parent B', 'parent', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson'),
  ('ottilieotto+jackson+parent+c@gmail.com', 'Jackson', 'Parent C', 'parent', (SELECT id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1), 'Jackson');

-- ============================================================================
-- IMPORTANT: User Creation with Passwords
-- ============================================================================
-- Supabase doesn't allow direct password insertion in SQL for security.
-- You have two options:
--
-- OPTION 1: Use Supabase Dashboard (Recommended for testing)
-- 1. Go to Authentication > Users
-- 2. Click "Add User" for each email
-- 3. Set password to "test12345"
-- 4. The profiles will be created automatically via triggers
--
-- OPTION 2: Use Supabase Management API (Better for automation)
-- See the script at the end of this file
--
-- For now, we'll create the profile records assuming users exist
-- ============================================================================

-- Step 5: Create profiles for users (assuming users are created via Dashboard/API)
-- Note: Profiles are usually created automatically via database triggers when auth.users are created
-- But we'll insert them manually here for users that might not exist yet

-- First, let's output the list of users that need to be created
SELECT 
  email,
  first_name || ' ' || last_name as full_name,
  role,
  club_name
FROM test_users_to_create
ORDER BY club_name, role, email;

-- ============================================================================
-- CONTINUE TO NEXT FILE: GENERATE_TEST_DATA_PART2.sql
-- This will create the actual data structures after users are created
-- ============================================================================


