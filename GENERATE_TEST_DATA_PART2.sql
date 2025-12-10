-- ============================================================================
-- GENERATE TEST DATA - PART 2: Create Data Structures
-- ============================================================================
-- Run this AFTER creating users in Supabase Dashboard or via API
-- This creates: households, athletes, coaches, programs, sub-programs, groups
-- ============================================================================

-- Step 1: Create households and link parents
DO $$
DECLARE
  user_rec RECORD;
  household_id UUID;
  gtssf_club_id UUID;
  jackson_club_id UUID;
BEGIN
  -- Get club IDs
  SELECT id INTO gtssf_club_id FROM clubs WHERE slug = 'gtssf' OR name ILIKE '%GTSSF%' LIMIT 1;
  SELECT id INTO jackson_club_id FROM clubs WHERE slug = 'jackson' OR name ILIKE '%Jackson%' LIMIT 1;
  
  -- Create households for each parent
  FOR user_rec IN 
    SELECT au.id as user_id, p.id as profile_id, p.role, p.club_id, p.email, p.first_name, p.last_name
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE p.role = 'parent'
    ORDER BY p.club_id, p.last_name
  LOOP
    -- Create household
    INSERT INTO households (club_id, primary_email, phone, address_line1, city, state, zip_code)
    VALUES (
      user_rec.club_id,
      user_rec.email,
      '555-0100',
      '123 Main St',
      'City',
      'WY',
      '83001'
    )
    RETURNING id INTO household_id;
    
    -- Link parent to household
    INSERT INTO household_guardians (household_id, user_id, is_primary)
    VALUES (household_id, user_rec.user_id, true)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created household for % %', user_rec.first_name, user_rec.last_name;
  END LOOP;
END $$;

-- Step 2: Create athletes for each parent
-- First name = Club name, Last name = "Athlete A", "Athlete B", etc. (sequential per club)
DO $$
DECLARE
  household_rec RECORD;
  athlete_id UUID;
  athlete_counter INTEGER := 0; -- Counter per club
  current_club_id UUID := NULL;
  athlete_letter CHAR;
BEGIN
  FOR household_rec IN
    SELECT 
      h.id as household_id, 
      h.club_id, 
      hg.user_id, 
      p.first_name as parent_first_name, -- This is the club name (GTSSF or Jackson)
      p.last_name as parent_last_name,
      c.name as club_name
    FROM households h
    JOIN household_guardians hg ON hg.household_id = h.id
    JOIN profiles p ON p.id = hg.user_id
    JOIN clubs c ON c.id = h.club_id
    WHERE hg.is_primary = true
    ORDER BY h.club_id, p.last_name
  LOOP
    -- Reset counter when we move to a new club
    IF current_club_id IS NULL OR current_club_id != household_rec.club_id THEN
      current_club_id := household_rec.club_id;
      athlete_counter := 0;
    END IF;
    
    -- Increment counter and get letter (A, B, C, etc.)
    athlete_counter := athlete_counter + 1;
    athlete_letter := CHR(64 + athlete_counter); -- A = 65, B = 66, etc.
    
    -- Create 2 athletes per parent
    -- First athlete: "Athlete A", "Athlete B", etc.
    INSERT INTO athletes (
      club_id,
      household_id,
      first_name,
      last_name,
      date_of_birth
    )
    VALUES (
      household_rec.club_id,
      household_rec.household_id,
      household_rec.parent_first_name, -- Club name (e.g., "GTSSF" or "Jackson")
      'Athlete ' || athlete_letter, -- "Athlete A", "Athlete B", etc.
      (CURRENT_DATE - INTERVAL '10 years')::DATE
    );
    
    -- Second athlete: "Athlete AB", "Athlete BB", etc.
    athlete_counter := athlete_counter + 1;
    athlete_letter := CHR(64 + athlete_counter);
    
    INSERT INTO athletes (
      club_id,
      household_id,
      first_name,
      last_name,
      date_of_birth
    )
    VALUES (
      household_rec.club_id,
      household_rec.household_id,
      household_rec.parent_first_name, -- Club name
      'Athlete ' || athlete_letter, -- "Athlete B", "Athlete C", etc.
      (CURRENT_DATE - INTERVAL '8 years')::DATE
    );
    
    RAISE NOTICE 'Created 2 athletes for % % parent (club: %)', household_rec.parent_first_name, household_rec.parent_last_name, household_rec.club_name;
  END LOOP;
END $$;

-- Step 3: Create coaches records
INSERT INTO coaches (profile_id, club_id, first_name, last_name, phone, email, bio)
SELECT 
  p.id,
  p.club_id,
  p.first_name,
  p.last_name,
  '555-0100',
  p.email,
  'Test coach profile for ' || p.first_name || ' ' || p.last_name
FROM profiles p
WHERE p.role = 'coach'
ON CONFLICT (profile_id) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Step 4: Create programs for each club/season
DO $$
DECLARE
  season_rec RECORD;
  program_id UUID;
  program_names TEXT[] := ARRAY['Alpine Skiing', 'Nordic Skiing', 'Freestyle Skiing'];
  program_descriptions TEXT[] := ARRAY[
    'Traditional downhill skiing program',
    'Cross-country skiing program',
    'Freestyle and terrain park program'
  ];
  program_name TEXT;
  program_desc TEXT;
  idx INTEGER;
BEGIN
  FOR season_rec IN
    SELECT s.id as season_id, s.club_id, c.name as club_name
    FROM seasons s
    JOIN clubs c ON c.id = s.club_id
    WHERE s.is_current = true
  LOOP
    idx := 1;
    FOREACH program_name IN ARRAY program_names
    LOOP
      program_desc := program_descriptions[idx];
      
      INSERT INTO programs (
        club_id,
        season_id,
        name,
        description,
        status
      )
      VALUES (
        season_rec.club_id,
        season_rec.season_id,
        program_name,
        program_desc,
        'ACTIVE'
      )
      RETURNING id INTO program_id;
      
      RAISE NOTICE 'Created program % for %', program_name, season_rec.club_name;
      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;

-- Step 5: Create sub-programs for each program
DO $$
DECLARE
  program_rec RECORD;
  sub_program_id UUID;
  sub_program_names TEXT[] := ARRAY['Beginner', 'Intermediate', 'Advanced'];
  sub_program_name TEXT;
  base_fee NUMERIC := 500.00;
BEGIN
  FOR program_rec IN
    SELECT p.id as program_id, p.name as program_name, p.club_id, p.season_id
    FROM programs p
    ORDER BY p.club_id, p.name
  LOOP
    FOREACH sub_program_name IN ARRAY sub_program_names
    LOOP
      INSERT INTO sub_programs (
        program_id,
        club_id,
        name,
        registration_fee,
        status,
        description
      )
      VALUES (
        program_rec.program_id,
        program_rec.club_id,
        program_rec.program_name || ' - ' || sub_program_name,
        base_fee,
        'ACTIVE',
        sub_program_name || ' level ' || program_rec.program_name || ' program'
      )
      RETURNING id INTO sub_program_id;
      
      base_fee := base_fee + 100.00;
    END LOOP;
    
    base_fee := 500.00; -- Reset for next program
  END LOOP;
END $$;

-- Step 6: Create groups for each sub-program
DO $$
DECLARE
  sub_program_rec RECORD;
  group_id UUID;
  group_names TEXT[] := ARRAY['Group 1', 'Group 2'];
  group_name TEXT;
  max_participants INTEGER := 15;
BEGIN
  FOR sub_program_rec IN
    SELECT sp.id as sub_program_id, sp.name as sub_program_name, sp.club_id
    FROM sub_programs sp
    ORDER BY sp.club_id, sp.name
  LOOP
    FOREACH group_name IN ARRAY group_names
    LOOP
      INSERT INTO groups (
        sub_program_id,
        club_id,
        name,
        max_participants,
        status,
        description
      )
      VALUES (
        sub_program_rec.sub_program_id,
        sub_program_rec.club_id,
        group_name,
        max_participants,
        'ACTIVE',
        group_name || ' for ' || sub_program_rec.sub_program_name
      )
      RETURNING id INTO group_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 7: Assign coaches to programs
INSERT INTO coach_assignments (coach_id, program_id, club_id, season_id, role)
SELECT 
  c.id as coach_id,
  p.id as program_id,
  c.club_id,
  s.id as season_id,
  'head_coach'
FROM coaches c
CROSS JOIN programs p
JOIN seasons s ON s.id = p.season_id AND s.club_id = c.club_id
WHERE s.is_current = true
ORDER BY RANDOM() -- Random assignment
LIMIT (SELECT COUNT(*) FROM coaches) * 2 -- Each coach gets 2 assignments
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check created data
SELECT 'Clubs' as type, COUNT(*) as count FROM clubs
UNION ALL
SELECT 'Seasons', COUNT(*) FROM seasons
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles WHERE email != 'ottilieotto@gmail.com'
UNION ALL
SELECT 'Households', COUNT(*) FROM households
UNION ALL
SELECT 'Athletes', COUNT(*) FROM athletes
UNION ALL
SELECT 'Coaches', COUNT(*) FROM coaches
UNION ALL
SELECT 'Programs', COUNT(*) FROM programs
UNION ALL
SELECT 'Sub-Programs', COUNT(*) FROM sub_programs
UNION ALL
SELECT 'Groups', COUNT(*) FROM groups
UNION ALL
SELECT 'Coach Assignments', COUNT(*) FROM coach_assignments;

-- List all test users by club and role
SELECT 
  c.name as club_name,
  p.role,
  p.first_name,
  p.last_name,
  p.email,
  CASE 
    WHEN p.role = 'parent' THEN (SELECT COUNT(*) FROM athletes a JOIN households h ON h.id = a.household_id JOIN household_guardians hg ON hg.household_id = h.id WHERE hg.user_id = p.id)
    ELSE NULL
  END as athlete_count
FROM profiles p
JOIN clubs c ON c.id = p.club_id
WHERE p.email != 'ottilieotto@gmail.com'
ORDER BY c.name, p.role, p.last_name;
